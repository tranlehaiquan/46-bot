import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanOutboundText } from "./clean-text.js";

describe("cleanOutboundText", () => {
  it("handles empty or falsy inputs", () => {
    assert.equal(cleanOutboundText(""), "");
    assert.equal(cleanOutboundText(null), "");
    assert.equal(cleanOutboundText(undefined), "");
    assert.equal(cleanOutboundText("   \n\t  "), "");
  });

  it("normalizes CRLF to LF", () => {
    const input = "Line 1\r\n\r\nLine 2";
    assert.equal(cleanOutboundText(input), "Line 1\n\nLine 2");
  });

  it("removes standalone horizontal rules (---, ***, ___, etc.) and collapses spacing", () => {
    const inputWithDashes = "Section 1\n\n---\n\nSection 2";
    assert.equal(cleanOutboundText(inputWithDashes), "Section 1\n\nSection 2");

    const inputWithStars = "Section 1\n\n***\n\nSection 2";
    assert.equal(cleanOutboundText(inputWithStars), "Section 1\n\nSection 2");

    const inputWithUnderscores = "Section 1\n___\nSection 2";
    assert.equal(cleanOutboundText(inputWithUnderscores), "Section 1\n\nSection 2");

    const inputWithSpacedDashes = "Section 1\n\n- - -\n\nSection 2";
    assert.equal(cleanOutboundText(inputWithSpacedDashes), "Section 1\n\nSection 2");

    const inputWithLongDivider = "Section 1\n--------------------------------\nSection 2";
    assert.equal(cleanOutboundText(inputWithLongDivider), "Section 1\n\nSection 2");

    const inputWithEmDashes = "Section 1\n\n———\n\nSection 2";
    assert.equal(cleanOutboundText(inputWithEmDashes), "Section 1\n\nSection 2");

    const inputWithBoxDrawing = "Section 1\n\n───\n\nSection 2";
    assert.equal(cleanOutboundText(inputWithBoxDrawing), "Section 1\n\nSection 2");
  });

  it("preserves list items, indented items, bold, and negative numbers", () => {
    const input = "- Item 1\n  - Sub-item 1\n  • Sub-item 2\n- Item 2";
    assert.equal(cleanOutboundText(input), input);

    const boldInput = "**Important note:** Value is -5 degrees.";
    assert.equal(cleanOutboundText(boldInput), boldInput);

    const boldItalicInput = "***Bold and Italic heading***";
    assert.equal(cleanOutboundText(boldItalicInput), boldItalicInput);
  });

  it("collapses multiple consecutive blank lines into at most one blank line", () => {
    const input = "Paragraph 1\n\n\n\n\nParagraph 2\n\n\nParagraph 3";
    assert.equal(
      cleanOutboundText(input),
      "Paragraph 1\n\nParagraph 2\n\nParagraph 3",
    );
  });

  it("removes lines with only spaces between newlines and trims trailing spaces", () => {
    const input = "Line 1   \n   \n   \nLine 2";
    assert.equal(cleanOutboundText(input), "Line 1\n\nLine 2");
  });

  it("cleans the exact case with huge gap and --- divider from user screenshot", () => {
    const userExample = `3. Thu nhập và lộ trình thăng tiến:

• Mới ra trường (Fresher/Management Trainee):
  • Làm ở công ty forwarder vừa và nhỏ: 9 – 13 triệu VNĐ/tháng.
  • Đỗ vào các chương trình Quản trị viên tập sự (MT) của các hãng đa quốc gia (Unilever, P&G, Nestlé, Maersk, Shopee): Khởi điểm 20 – 35 triệu VNĐ/tháng.
• Sau 3 – 5 năm (Senior / Supervisor / Demand Planner): Dao động 25 – 45 triệu VNĐ/tháng.
• Cấp Quản lý (Supply Chain Manager / Operations Director): Từ 60 – 120+ triệu VNĐ/tháng.



---



⚖️ ƯU ĐIỂM VÀ THỬ THÁCH CẦN LƯU Ý

• Ưu điểm lớn:
  • Tính cơ động cao: Ngành nghề nào cũng cần chuỗi cung ứng (từ đồ ăn, thuốc tây, xe cộ cho đến quần áo, điện thoại).
  • Rất khó bị AI thay thế: AI có thể phân tích số liệu dự báo, nhưng khi xảy ra tắc nghẽn cảng biển, bão lũ, tàu kẹt kênh đào Suez hay nhà cung cấp giao trễ... thì bắt buộc phải có con người đứng ra đàm phán, xoay xở và đổi tuyến linh hoạt.
• Thách thức:
  • Ngoại ngữ là sống còn: Giao tiếp hàng ngày hầu hết bằng Tiếng Anh (họp với đối tác nước ngoài, gửi mail báo giá quốc tế). Nếu biết thêm Tiếng Trung thì giá trị bản thân tăng gấp đôi vì phần lớn chuỗi cung ứng nguyên phụ liệu đều nhập từ Trung Quốc.
  • Áp lực cao (High Stress): Ngành này đòi hỏi giải quyết vấn đề nhanh, đôi khi phải xử lý sự cố hàng hóa lệch giờ quốc tế (giờ đêm).

Nếu người học là người nhanh nhẹn, thích giao tiếp, thích điều phối xử lý tình huống thực tế và có tư duy logic về con số, thì Logistics & SCM là một ngành vừa thực chiến vừa có tương lai phát triển toàn cầu cực kỳ tốt anh nhé!`;

    const cleaned = cleanOutboundText(userExample);

    // Assert --- is completely gone
    assert.ok(!cleaned.includes("---"));
    // Assert there are no 3+ newlines (useless voids)
    assert.ok(!cleaned.includes("\n\n\n"));
    // Assert sections are cleanly separated with standard paragraph break
    assert.ok(
      cleaned.includes(
        "• Cấp Quản lý (Supply Chain Manager / Operations Director): Từ 60 – 120+ triệu VNĐ/tháng.\n\n⚖️ ƯU ĐIỂM VÀ THỬ THÁCH CẦN LƯU Ý",
      ),
    );
  });
});
