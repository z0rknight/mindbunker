import type { Metadata } from "next";
import { redirect } from "next/navigation";

// /book was the general public video-work intake form; /quoteavideo now
// cleanly replaces it (superset of fields, same lookup-or-create-by-email
// CRM path) per Client Service Reality Patch section 2 -- "Do not
// maintain two competing intake systems." The actual call-request
// infrastructure this page used to host (BookingRequestForm /
// submitPublicBookingRequest) was NOT removed: it now lives embedded,
// demoted, inside /quoteavideo's collapsed "Need to talk first?" section
// (brief section 1), so nothing here is lost, just relocated.
export const metadata: Metadata = {
  title: "Request a video | RMedia",
};

export default function PublicBookPage() {
  redirect("/quoteavideo");
}
