import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DisclaimerLink } from "@/components/shared/filter-sort-drawer";
import { AllVendorsPage } from "@/components/vendors/all-vendors-page";

export default function VendorsPage() {
  return <Card className="overflow-hidden bg-white"><CardContent className="p-6">
    <h1 className="text-3xl font-bold mb-6 text-slate-800">Barefoot Bay Preferred Vendors</h1>
    <div className="flex flex-wrap gap-4 -mt-4 mb-6">
      <Dialog>
        <DialogTrigger asChild><DisclaimerLink label="User Disclaimer" data-testid="link-user-disclaimer" /></DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto p-4 sm:p-6 mt-4">
          <DialogHeader className="pb-2"><DialogTitle className="text-base sm:text-lg font-semibold">User Disclaimer</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-700 leading-relaxed">These vendors have supported The Tattler newspaper and have provided quality services to the Barefoot Bay community. The vendors included in this list must have a proven track record of quality service, reliability, and be recommended by multiple community residents to be considered.</p>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild><DisclaimerLink label="Vendor Disclaimer" data-testid="link-vendor-disclaimer" /></DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-auto p-4 sm:p-6 mt-4">
          <DialogHeader className="pb-2"><DialogTitle className="text-base sm:text-lg font-semibold">Vendor Disclaimer</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-700 leading-relaxed">You can be included in this exclusive list by contacting The Tattler newspaper, emailing team@barefootbay.com, or by messaging Rob Allan (ADMIN) on this platform.</p>
        </DialogContent>
      </Dialog>
    </div>
    <AllVendorsPage />
  </CardContent></Card>;
}
