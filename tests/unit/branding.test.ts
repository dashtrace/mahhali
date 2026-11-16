import { describe, expect, it } from "vitest";
import { common } from "@/i18n/messages/common";
import { authMessages } from "@/i18n/messages/auth";
import { metricsMessages } from "@/i18n/messages/money";

describe("StoreLift branding", () => {
  it("uses the same platform name in English and Arabic", () => {
    expect(common.en.appName).toBe("StoreLift");
    expect(common.ar.appName).toBe("StoreLift");
    expect(common.en.poweredBy).toContain("StoreLift");
    expect(common.ar.poweredBy).toContain("StoreLift");
  });

  it("uses StoreLift in onboarding and performance copy", () => {
    for (const locale of ["en", "ar"] as const) {
      expect(authMessages[locale].baselineTitle).toContain("StoreLift");
      expect(metricsMessages[locale].before).toContain("StoreLift");
      expect(metricsMessages[locale].during).toContain("StoreLift");
      expect(metricsMessages[locale].meaningBefore).toContain("StoreLift");
    }
  });
});
