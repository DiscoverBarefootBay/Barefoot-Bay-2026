import AdminLayout from "@/components/layouts/admin-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Clock } from "lucide-react";
import WeeklyListingsTab from "./weekly-listings-tab";
import ForSaleEmailsTab from "./forsale-emails-tab";

export default function OnTheMarketEmailsPage() {
  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">On The Market Emails</h1>
          <p className="text-muted-foreground mt-1">
            Configure automated emails for the For Sale / On The Market section — the weekly digest sent to all subscribers and the expiration alerts sent to admins and sellers.
          </p>
        </div>

        <Tabs defaultValue="weekly">
          <TabsList>
            <TabsTrigger value="weekly">
              <Clock className="h-4 w-4 mr-2" />
              Weekly Digest
            </TabsTrigger>
            <TabsTrigger value="expiration">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Listing Expiration Emails
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="mt-6">
            <WeeklyListingsTab />
          </TabsContent>

          <TabsContent value="expiration" className="mt-6">
            <ForSaleEmailsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
