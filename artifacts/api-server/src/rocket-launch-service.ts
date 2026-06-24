import fetch from 'node-fetch';

interface RocketLaunchResponse {
  result: {
    id: string;
    name: string;
    provider: {
      name: string;
    };
    vehicle: {
      name: string;
    };
    pad: {
      name: string;
      location: {
        name: string;
        state?: string;
      };
    };
    missions: {
      name: string;
      description: string;
    }[];
    win_open: string | null;
    win_close: string | null;
    t0: string | null;
    est_date: {
      month: number | null;
      day: number | null;
      year: number | null;
      quarter: number | null;
    } | null;
    launch_description: string | null;
    weather_concerns: string | null;
    weather_temp: number | null;
    weather_icon: string | null;
    quicktext: string | null;
    result?: number | null;   // -1: scrubbed, 0: failure, 1: success
    modified?: string | null; // Timestamp of when the launch data was last modified
    status?: string;          // Alternative status field in some API responses
    last_updated?: string;    // Alternative timestamp field in some API responses
    [key: string]: any;       // Allow for additional fields in the API response
  }[];
}

// Locations in Florida where rocket launches are typically visible from Barefoot Bay
const FLORIDA_LOCATIONS = [
  "Cape Canaveral", 
  "Kennedy Space Center",
  "Cape Canaveral Space Force Station",
  "Cape Canaveral SFS", // Add SFS abbreviation
  "Florida"
];

/**
 * Helper function to check if a launch appears to be rescheduled
 * This detects situations where the API still has result: -1 (scrubbed)
 * but the launch has a future time, suggesting it was rescheduled
 */
function isRescheduledLaunch(launch: any) {
  // First check if it's marked as scrubbed
  if (launch.result !== -1) return false;
  
  // Then check if it has a future launch time
  const launchTimeStr = launch.t0 || launch.win_open;
  if (!launchTimeStr) return false;
  
  // Compare with current time
  const launchTime = new Date(launchTimeStr).getTime();
  const currentTime = new Date().getTime();
  
  // BUGFIX: Don't override results for launches that have already occurred
  // Add 2-hour grace period after launch time to prevent state switching after successful launches
  const twoHoursMs = 2 * 60 * 60 * 1000;
  if (currentTime > launchTime + twoHoursMs) {
    // Launch has already passed its window + grace period, don't override the API result
    console.log(`Launch ${launch.name} has passed its window (${new Date(launchTime).toISOString()}), not overriding result`);
    return false;
  }
  
  // If launch time is in the future (within 7 days), it's likely rescheduled
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const isInFutureWithinWindow = launchTime > currentTime && launchTime < currentTime + sevenDaysMs;
  
  if (isInFutureWithinWindow) {
    console.log(`Launch ${launch.name} appears to be rescheduled (scrubbed but has future launch time: ${new Date(launchTime).toISOString()})`);
  }
  
  return isInFutureWithinWindow;
}

/**
 * Helper function to normalize stale scrubbed results using a temporal-first approach
 * This detects situations where the API still has result: -1 (scrubbed)
 * but the launch has already happened and completed, leaving a stale scrubbed status
 * 
 * Strategy: Prioritize time-based heuristics over keyword matching to avoid
 * historical scrub references incorrectly overriding successful launches
 * 
 * CRITICAL: Never change successful launches (result === 1) to any other state
 */
function normalizeLaunchResult(launch: any, currentResult: number | null | undefined): number | null {
  // CRITICAL: Protect successful launches - once successful, always successful
  if (currentResult === 1) {
    console.log(`[NORMALIZE] Launch ${launch.name}: Already successful (result=1), preserving success status`);
    return 1;
  }
  
  // Only process if currently marked as scrubbed
  if (currentResult !== -1) return currentResult ?? null;
  
  // Get the launch time
  const launchTimeStr = launch.t0 || launch.win_open;
  if (!launchTimeStr) {
    // No launch time means it's truly scrubbed (indefinitely postponed)
    console.log(`[NORMALIZE] Launch ${launch.name}: No launch time, keeping scrubbed status`);
    return currentResult;
  }
  
  const launchTime = new Date(launchTimeStr).getTime();
  const currentTime = new Date().getTime();
  const timeSinceLaunch = currentTime - launchTime;
  
  // Only normalize if the launch time has passed
  if (currentTime <= launchTime) {
    // Launch hasn't happened yet, keep scrubbed status
    console.log(`[NORMALIZE] Launch ${launch.name}: Future launch (T-${Math.round((launchTime - currentTime) / 60000)}m), keeping scrubbed`);
    return currentResult;
  }
  
  console.log(`[NORMALIZE] Launch ${launch.name}: Analyzing scrubbed status (T+${Math.round(timeSinceLaunch / 60000)}m)`);
  
  // Get modified timestamp info
  const modifiedTime = launch.modified ? new Date(launch.modified).getTime() : null;
  const timeSinceModified = modifiedTime ? currentTime - modifiedTime : null;
  
  if (modifiedTime) {
    console.log(`[NORMALIZE] Launch ${launch.name}: Modified ${Math.round(timeSinceModified! / 60000)}m ago`);
  }
  
  // KEYWORD ANALYSIS: Check text for completion and scrub indicators
  const description = (launch.launch_description || '').toLowerCase();
  const quicktext = (launch.quicktext || '').toLowerCase();
  const combinedText = `${description} ${quicktext}`;
  
  // Success indicators (present tense or completion verbs)
  const successPatterns = [
    /has lifted off/i,
    /liftoff confirmed/i,
    /successfully launched/i,
    /launch was successful/i,
    /successfully deployed/i,
    /deployment successful/i,
    /reached orbit/i,
    /achieved orbit/i,
    /mission successful/i,
    /launch success/i,
    /is in orbit/i,
    /now in orbit/i
  ];
  
  // Current scrub indicators (present tense, active state)
  const currentScrubPatterns = [
    /is scrubbed/i,
    /launch scrubbed/i,
    /scrub today/i,
    /standing down/i,
    /stand down/i,
    /currently postponed/i,
    /has been scrubbed/i,
    /attempt scrubbed/i,
    /no earlier than/i,  // NET = still pending
    /targeting a new/i,
    /new target date/i
  ];
  
  // Past scrub indicators (past tense - don't count these as active scrubs)
  const pastScrubPatterns = [
    /was scrubbed/i,
    /after (?:the )?(?:earlier )?scrub/i,
    /following (?:the )?scrub/i,
    /previous scrub/i,
    /yesterday's scrub/i
  ];
  
  // Check for success indicators first (highest priority)
  const hasSuccessIndicator = successPatterns.some(pattern => pattern.test(combinedText));
  if (hasSuccessIndicator) {
    console.log(`[NORMALIZE] Launch ${launch.name}: Found success indicators, marking as successful`);
    return 1; // Mark as successful
  }
  
  // Check if scrub mentions are in past tense (historical context)
  const hasPastScrubMention = pastScrubPatterns.some(pattern => pattern.test(combinedText));
  if (hasPastScrubMention) {
    console.log(`[NORMALIZE] Launch ${launch.name}: Found past-tense scrub mentions (historical context), clearing scrubbed status`);
    return null; // Historical scrub reference, not current state
  }
  
  // PRIORITY CHECK: If modified timestamp is BEFORE the launch time by >10 min,
  // it indicates a pre-launch scrub that was likely lifted. Check this BEFORE keyword analysis
  // to prevent stale scrub keywords from incorrectly overriding successful launches.
  if (modifiedTime && modifiedTime < launchTime) {
    const timeBetweenModifiedAndLaunch = launchTime - modifiedTime;
    const tenMinutesMs = 10 * 60 * 1000;
    
    // If scrub was announced >10 minutes before launch and we're now past launch time,
    // it's likely the scrub was lifted and launch proceeded
    if (timeBetweenModifiedAndLaunch > tenMinutesMs) {
      console.log(`[NORMALIZE] Launch ${launch.name}: Scrub announced ${Math.round(timeBetweenModifiedAndLaunch / 60000)}m before launch, clearing stale scrubbed status`);
      return null; // Clear scrubbed status
    }
  }
  
  // Check for current scrub indicators (only if pre-launch check didn't clear it)
  const hasCurrentScrubIndicator = currentScrubPatterns.some(pattern => pattern.test(combinedText));
  if (hasCurrentScrubIndicator) {
    console.log(`[NORMALIZE] Launch ${launch.name}: Found current scrub indicators, maintaining scrubbed status`);
    return currentResult; // Keep scrubbed
  }
  
  // If we reach here: launch time has passed, no success indicators, no past-tense scrub language,
  // no current scrub indicators. This is ambiguous - could be either:
  // 1. A successful launch with no API update yet
  // 2. A genuine scrub with no follow-up updates
  // Be conservative and keep the scrubbed status to avoid misinforming users
  console.log(`[NORMALIZE] Launch ${launch.name}: Ambiguous status post-launch, keeping scrubbed (no clear evidence of success)`);
  return currentResult;
}

export async function getUpcomingRocketLaunches() {
  try {
    // With premium API access, we can filter by state to get ALL Florida launches
    // Using the /pads endpoint to find Florida launch pads, then /launches with pad_id
    // Alternatively, use state_abbr=FL parameter
    
    const apiKey = process.env.ROCKET_LAUNCH_API_KEY;
    if (!apiKey) {
      console.error('ROCKET_LAUNCH_API_KEY environment variable is not set');
      throw new Error('RocketLaunch.Live API key is required');
    }
    
    // Get upcoming launches for the next 30 days with Florida filter
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const afterDate = new Date().toISOString().split('T')[0];
    const beforeDate = thirtyDaysFromNow.toISOString().split('T')[0];
    
    const url = `https://fdo.rocketlaunch.live/json/launches?after_date=${afterDate}&before_date=${beforeDate}&state_abbr=FL`;
    
    console.log(`Fetching Florida rocket launch data from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      console.error(`Error fetching rocket launch data: ${response.status}`);
      throw new Error(`Failed to fetch rocket launch data: ${response.status}`);
    }
    
    const rawData = await response.json() as any;
    console.log(`Rocket launch API response (count: ${rawData.response?.result?.length || rawData.result?.length || 0}):`, JSON.stringify(rawData, null, 2));
    
    // The premium API wraps the data in a "response" object, while the free API returns it directly
    const data: RocketLaunchResponse = rawData.response || rawData;
    
    if (!data.result || !Array.isArray(data.result)) {
      console.error("Invalid data format received from RocketLaunch.Live API");
      return [];
    }
    
    // With premium API, all results should already be Florida launches from the state_abbr filter
    // No additional filtering needed, but we'll still validate
    const visibleLaunches = data.result.filter(launch => {
      // Validate that the launch has required data
      const hasLaunchTime = launch.t0 || launch.win_open;
      if (!hasLaunchTime) {
        console.log(`Launch ${launch.name} excluded: no launch time available`);
        return false;
      }
      return true;
    });
    
    console.log(`Found ${visibleLaunches.length} Florida launches from premium API`);
    
    // Log raw data to troubleshoot
    console.log('Rocket launch raw data from API:', JSON.stringify(visibleLaunches.slice(0, 1), null, 2));
    
    // Map the API response to match our expected format
    return visibleLaunches.map(launch => {
      // Try to get the most precise launch date available
      let formattedDate = null;
      let padTime = null;
      
      // Always use t0 as the official pad launch time when available
      if (launch.t0) {
        padTime = launch.t0;
        formattedDate = launch.t0; // Default to using t0 for window_start too
      }
      // Fallback to win_open if t0 is not available
      else if (launch.win_open) {
        formattedDate = launch.win_open;
      } 
      // As a last resort, if we have est_date with month/day/year, create a date
      else if (launch.est_date && launch.est_date.year && launch.est_date.month && launch.est_date.day) {
        // For estimated dates, use 4:00 PM UTC as the default time
        const month = launch.est_date.month;
        const day = launch.est_date.day;
        const year = launch.est_date.year;
        formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T16:00:00Z`;
      }
      
      // Check for the result field in the API response - look for 'result' or 'status' field
      let launchResult = null;
      if ('result' in launch) {
        console.log(`Launch ${launch.name} has result field: ${launch.result}`);
        launchResult = launch.result;
        
        // Use our helper function to detect if this is a rescheduled launch
        if (isRescheduledLaunch(launch)) {
          console.log(`Launch ${launch.name} appears to be rescheduled (has scrubbed result but future launch time)`);
          // Override the scrubbed status for rescheduled launches
          launchResult = null;
        }
        
        // Normalize stale scrubbed results (for launches that completed but API still shows scrubbed)
        launchResult = normalizeLaunchResult(launch, launchResult);
      } else if ('status' in launch) {
        console.log(`Launch ${launch.name} has status field: ${launch.status}`);
        launchResult = launch.status === 'scrubbed' ? -1 : null;
        // Also normalize status-based results
        launchResult = normalizeLaunchResult(launch, launchResult);
      }
      
      // Check for the modified timestamp in the API response
      let modifiedTimestamp = null;
      if ('modified' in launch) {
        console.log(`Launch ${launch.name} has modified timestamp: ${launch.modified}`);
        modifiedTimestamp = launch.modified;
      } else if ('last_updated' in launch) {
        console.log(`Launch ${launch.name} has last_updated timestamp: ${launch.last_updated}`);
        modifiedTimestamp = launch.last_updated;
      }
      
      // Extra debugging for specific launches we're tracking
      if (launch.name && (launch.name.includes('Kuiper') || launch.name.includes('Starlink'))) {
        console.log(`Enhanced debugging for ${launch.name}:`, {
          name: launch.name,
          result: launchResult,
          original_result: launch.result,
          modified: modifiedTimestamp,
          t0: launch.t0,
          win_open: launch.win_open,
          is_rescheduled: isRescheduledLaunch(launch),
          description: launch.launch_description?.substring(0, 100) // Truncate long descriptions
        });
      }
      
      return {
        id: launch.id,
        name: launch.name,
        provider: launch.provider,
        vehicle: launch.vehicle,
        pad: launch.pad,
        missions: launch.missions,
        window_start: formattedDate,
        window_end: launch.win_close,
        pad_time: padTime,  // Include the official t0 pad time
        launch_description: launch.launch_description,
        est_date: launch.est_date,
        weather_concerns: launch.weather_concerns,
        weather_temp: launch.weather_temp,
        weather_condition: launch.weather_icon ? launch.weather_icon.replace(/-/g, ' ') : null,
        quicktext: launch.quicktext,
        result: launchResult,    // Use our detected result value
        modified: modifiedTimestamp  // Use our detected modified timestamp
      };
    });
  } catch (error) {
    console.error("Error in getUpcomingRocketLaunches:", error);
    throw error;
  }
}