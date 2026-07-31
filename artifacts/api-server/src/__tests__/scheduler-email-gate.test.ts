import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isSchedulerEmailSendingEnabled,
  isListingExpirationEmailSendingEnabled,
  isWeeklyListingsEmailSendingEnabled,
} from "../scheduler-email-gate";
import { runListingExpirationTick } from "../listing-expiration-scheduler";
import { checkExpiredListings } from "../listing-expiration-service";
import { runWeeklyListingsEmailTick } from "../weekly-listings-scheduler";

describe("isSchedulerEmailSendingEnabled", () => {
  test("blocks sending in a plain dev environment", () => {
    assert.equal(
      isSchedulerEmailSendingEnabled("ANY_DEV_FLAG", { NODE_ENV: "development" }),
      false,
    );
    assert.equal(isSchedulerEmailSendingEnabled("ANY_DEV_FLAG", {}), false);
  });

  test("allows sending when NODE_ENV=production", () => {
    assert.equal(
      isSchedulerEmailSendingEnabled("ANY_DEV_FLAG", { NODE_ENV: "production" }),
      true,
    );
  });

  test("allows sending when REPLIT_DEPLOYMENT=true", () => {
    assert.equal(
      isSchedulerEmailSendingEnabled("ANY_DEV_FLAG", {
        NODE_ENV: "development",
        REPLIT_DEPLOYMENT: "true",
      }),
      true,
    );
  });

  test("honors the explicit dev opt-in flag", () => {
    assert.equal(
      isSchedulerEmailSendingEnabled("ANY_DEV_FLAG", {
        NODE_ENV: "development",
        ANY_DEV_FLAG: "true",
      }),
      true,
    );
    // Only the literal string "true" opts in.
    assert.equal(
      isSchedulerEmailSendingEnabled("ANY_DEV_FLAG", {
        NODE_ENV: "development",
        ANY_DEV_FLAG: "1",
      }),
      false,
    );
  });
});

describe("listing-expiration gate wiring", () => {
  test("uses LISTING_SCHEDULER_DEV_SENDING as its opt-in flag", () => {
    assert.equal(isListingExpirationEmailSendingEnabled({ NODE_ENV: "development" }), false);
    assert.equal(
      isListingExpirationEmailSendingEnabled({
        NODE_ENV: "development",
        LISTING_SCHEDULER_DEV_SENDING: "true",
      }),
      true,
    );
    assert.equal(isListingExpirationEmailSendingEnabled({ NODE_ENV: "production" }), true);
    assert.equal(isListingExpirationEmailSendingEnabled({ REPLIT_DEPLOYMENT: "true" }), true);
  });

  test("weekly listings gate uses WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING", () => {
    assert.equal(isWeeklyListingsEmailSendingEnabled({ NODE_ENV: "development" }), false);
    assert.equal(
      isWeeklyListingsEmailSendingEnabled({
        NODE_ENV: "development",
        WEEKLY_LISTINGS_SCHEDULER_DEV_SENDING: "true",
      }),
      true,
    );
    assert.equal(isWeeklyListingsEmailSendingEnabled({ NODE_ENV: "production" }), true);
  });
});

describe("runListingExpirationTick environment gate", () => {
  test("skips the scan and reminder but clears stale tracking state when sending is disabled", async () => {
    let scanned = false;
    let reminded = false;
    let stateReset = false;
    await runListingExpirationTick({
      isEmailSendingEnabled: () => false,
      checkExpiredListings: async () => {
        scanned = true;
        return { checked: 0, renewed: 0, expired: 0, deleted: 0 };
      },
      checkNoActiveListingsReminder: async () => {
        reminded = true;
      },
      resetEmptyListingsState: async () => {
        stateReset = true;
      },
    });
    assert.equal(scanned, false, "expiration scan must not run when gated off");
    assert.equal(reminded, false, "empty-page reminder must not run when gated off");
    assert.equal(stateReset, true, "stale empty-listings state must be cleared even while gated off");
  });

  test("runs the scan and reminder when sending is enabled", async () => {
    let scanned = false;
    let reminded = false;
    let stateReset = false;
    await runListingExpirationTick({
      isEmailSendingEnabled: () => true,
      checkExpiredListings: async () => {
        scanned = true;
        return { checked: 0, renewed: 0, expired: 0, deleted: 0 };
      },
      checkNoActiveListingsReminder: async () => {
        reminded = true;
      },
      resetEmptyListingsState: async () => {
        stateReset = true;
      },
    });
    assert.equal(scanned, true);
    assert.equal(reminded, true);
    assert.equal(stateReset, false, "gated-off housekeeping reset must not run on the enabled path");
  });
});

describe("checkExpiredListings service-level environment gate", () => {
  // The gate lives inside the service so EVERY caller is covered — the
  // background scheduler, the manual scheduled-tasks trigger, and the
  // admin/test routes that import checkExpiredListings directly.
  test("returns a skipped result without touching the DB when sending is disabled", async () => {
    const result = await checkExpiredListings(undefined, { isEmailSendingEnabled: () => false });
    assert.deepEqual(result, {
      checked: 0,
      renewed: 0,
      expired: 0,
      deleted: 0,
      skipped: true,
      skipReason: "Email sending is disabled in this environment (not deployed production)",
    });
  });

  test("defaults to the real environment gate (blocked in a plain dev env)", async () => {
    // In the test environment NODE_ENV is not "production", REPLIT_DEPLOYMENT
    // is unset, and the opt-in flag is unset — so the default gate must block.
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.REPLIT_DEPLOYMENT !== "true" &&
      process.env.LISTING_SCHEDULER_DEV_SENDING !== "true"
    ) {
      const result = await checkExpiredListings();
      assert.equal((result as any).skipped, true);
    }
  });
});

describe("runWeeklyListingsEmailTick environment gate", () => {
  const failIfCalled = (label: string) => async (): Promise<never> => {
    throw new Error(`${label} must not be called when the gate is off`);
  };

  test("returns null before touching config or DB when sending is disabled", async () => {
    const result = await runWeeklyListingsEmailTick(new Date(), {
      isEmailSendingEnabled: () => false,
      loadConfig: failIfCalled("loadConfig"),
      getListings: failIfCalled("getListings"),
      getUsers: failIfCalled("getUsers"),
      sendEmail: failIfCalled("sendEmail") as any,
      claimWeeklySend: failIfCalled("claimWeeklySend") as any,
      finalizeWeeklySend: failIfCalled("finalizeWeeklySend") as any,
      getWeeklySendForWeek: failIfCalled("getWeeklySendForWeek") as any,
      getOverlappingBlockingSend: failIfCalled("getOverlappingBlockingSend") as any,
    });
    assert.equal(result, null);
  });

  test("proceeds to load the config when sending is enabled", async () => {
    let configLoaded = false;
    const result = await runWeeklyListingsEmailTick(new Date(), {
      isEmailSendingEnabled: () => true,
      loadConfig: async () => {
        configLoaded = true;
        // Disabled automation stops the tick right after the config load, so
        // no DB or SendGrid dependency is ever reached in this test.
        return { enabled: false } as any;
      },
      getListings: failIfCalled("getListings"),
      getUsers: failIfCalled("getUsers"),
      sendEmail: failIfCalled("sendEmail") as any,
      claimWeeklySend: failIfCalled("claimWeeklySend") as any,
      finalizeWeeklySend: failIfCalled("finalizeWeeklySend") as any,
      getWeeklySendForWeek: failIfCalled("getWeeklySendForWeek") as any,
      getOverlappingBlockingSend: failIfCalled("getOverlappingBlockingSend") as any,
    });
    assert.equal(configLoaded, true);
    assert.equal(result, null);
  });
});
