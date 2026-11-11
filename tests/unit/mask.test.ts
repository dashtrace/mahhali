import { describe, expect, it } from "vitest";
import { maskAddress, maskName, maskPhone, maskText } from "@/server/domain/mask";

describe("customer details shown to AI assistants", () => {
  it("keeps the first name and last initial", () => {
    expect(maskName("Rami Khoury")).toBe("Rami K.");
    expect(maskName("رامي الخوري")).toBe("رامي ا.");
    expect(maskName("Rami")).toBe("Rami");
  });

  it("shows only the country code, first digit and last two digits of a phone", () => {
    expect(maskPhone("+96171234523")).toBe("+961 7•••••23");
    expect(maskPhone("+9613123456")).toBe("+961 3••••56");
    expect(maskPhone("+14155552671")).toBe("+1 4•••••••71");
    expect(maskPhone("+447911123456")).toBe("+44 7•••••••56");
  });

  it("never returns the digits of a phone it cannot parse", () => {
    expect(maskPhone("12345")).toBe("•••45");
    expect(maskPhone("7")).toBe("•");
    expect(maskPhone("")).toBe("");
  });

  it("keeps the address down to the area", () => {
    const masked = maskAddress({
      governorate: "Mount Lebanon",
      district: "Metn",
      area: "Jdeideh",
      addressLine: "Main road, Building 4, floor 2",
      landmark: "next to the pharmacy",
    });
    expect(masked).toEqual({ governorate: "Mount Lebanon", district: "Metn", area: "Jdeideh" });
  });

  it("hides phones and emails inside customer notes", () => {
    expect(maskText("Call me on 71 234 523 before coming")).toBe("Call me on [phone hidden] before coming");
    expect(maskText("or +961-3-123456")).toBe("or [phone hidden]");
    expect(maskText("رقمي ٠٣١٢٣٤٥٦ شكرا")).toBe("رقمي [phone hidden] شكرا");
    expect(maskText("email maya@example.com please")).toBe("email [email hidden] please");
  });

  it("leaves short numbers in notes alone", () => {
    expect(maskText("2 bags, floor 3, building 12")).toBe("2 bags, floor 3, building 12");
    expect(maskText("deliver after 5:30")).toBe("deliver after 5:30");
  });
});
