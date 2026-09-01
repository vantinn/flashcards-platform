import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./error-message";
import { ApiError } from "./api-client";
import { createTranslator } from "./i18n/dictionary";
import vi from "./i18n/dictionaries/vi";
import en from "./i18n/dictionaries/en";

const tVi = createTranslator(vi);
const tEn = createTranslator(en);

describe("getErrorMessage", () => {
  it("maps a known backend message to the localized string (Vietnamese)", () => {
    const error = new ApiError(401, "Invalid email or password");
    expect(getErrorMessage(error, tVi)).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("maps the same known backend message to English when that's the active locale", () => {
    const error = new ApiError(401, "Invalid email or password");
    expect(getErrorMessage(error, tEn)).toBe("Invalid email or password.");
  });

  it("maps a dynamic OTP-cooldown message (varying wait time) to the generic rate-limited translation", () => {
    const error = new ApiError(429, "Please wait 45s before requesting another code.");
    expect(getErrorMessage(error, tVi)).toBe("Vui lòng đợi trước khi thử lại.");
  });

  it("falls back to a localized generic message for an unrecognized backend message, never showing raw English", () => {
    const error = new ApiError(400, "title should not be empty");
    expect(getErrorMessage(error, tVi)).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });

  it("falls back to a localized generic message when the backend sent no message at all", () => {
    const error = new ApiError(500, "");
    expect(getErrorMessage(error, tVi)).toBe("Đã xảy ra lỗi. Vui lòng thử lại.");
  });

  it("uses the network-error translation for a non-ApiError (request never reached the server)", () => {
    expect(getErrorMessage(new TypeError("Failed to fetch"), tVi)).toBe(
      "Không thể kết nối đến máy chủ. Vui lòng thử lại.",
    );
  });
});
