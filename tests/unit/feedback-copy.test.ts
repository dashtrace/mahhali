import { describe, expect, it } from "vitest";
import { storeMessages } from "@/i18n/messages/store";

describe("feedback confirmation and consent", () => {
  it("thanks the customer without promising publication", () => {
    for (const locale of ["en", "ar"] as const) {
      expect(storeMessages[locale].feedbackSent).not.toMatch(/approv|publish|موافق|نشر/i);
      expect(storeMessages[locale].feedbackSent.length).toBeGreaterThan(0);
    }
  });
  it("explains the optional-publication consent without approval language", () => {
    expect(storeMessages.en.consent).toBe("I allow my name and feedback to appear on this website.");
    expect(storeMessages.ar.consent).not.toMatch(/موافقته|نشر|بعد /);
  });
});
