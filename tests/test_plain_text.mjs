import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Model from "../Model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function extractQmlBlocks(content, blockType) {
  const regex = new RegExp(`\\b${blockType}\\s*\\{`, "g");
  let match;
  const blocks = [];
  while ((match = regex.exec(content)) !== null) {
    let braceCount = 1;
    let index = regex.lastIndex;
    while (index < content.length && braceCount > 0) {
      const ch = content[index];
      if (ch === "{") braceCount++;
      else if (ch === "}") braceCount--;
      index++;
    }
    const blockContent = content.slice(match.index, index);
    blocks.push({
      start: match.index,
      end: index,
      content: blockContent,
    });
  }
  return blocks;
}

test("malicious OPML metadata is preserved literally by parser and not converted to rich text", () => {
  const maliciousOpml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>&lt;script&gt;alert(1)&lt;/script&gt;</title>
  </head>
  <body>
    <outline text="&lt;img src=&quot;https://attacker.invalid/pixel&quot;&gt;" title="&lt;img src=&quot;https://attacker.invalid/pixel&quot;&gt;">
      <outline
        text="&lt;b&gt;Malicious Feed&lt;/b&gt;"
        title="&lt;a href=&quot;https://attacker.invalid/&quot;&gt;Click me&lt;/a&gt;"
        type="rss"
        xmlUrl="https://example.com/feed.xml"
      />
    </outline>
  </body>
</opml>`;

  const details = Model.parseOpmlDetails(maliciousOpml);
  assert.equal(details.totalFound, 1);
  assert.equal(details.invalidCount, 0);
  assert.equal(details.feeds.length, 1);
  assert.equal(details.feeds[0], "https://example.com/feed.xml");

  const sub = details.subscriptions[0];
  assert.equal(sub.category, '<img src="https://attacker.invalid/pixel">');
  assert.deepEqual(sub.categoryPath, ['<img src="https://attacker.invalid/pixel">']);
  assert.equal(sub.title, '<a href="https://attacker.invalid/">Click me</a>');

  const categories = details.categories;
  assert.deepEqual(categories, ['<img src="https://attacker.invalid/pixel">']);

  // Verify import result retains exact literal metadata without sanitizing away or executing
  const result = Model.calculateImportResult([], details, '<malicious-filename.opml>');
  assert.equal(result.status, "success");
  assert.equal(result.imported, 1);
  assert.equal(result.message, 'Imported 1 feed from <malicious-filename.opml>');

  // Category extraction handles malicious literal strings cleanly
  const cats = Model.extractCategories(result.newSubscriptions, [], []);
  const maliciousCat = cats.find((c) => c.name === '<img src="https://attacker.invalid/pixel">');
  assert.ok(maliciousCat);
  assert.equal(maliciousCat.name, '<img src="https://attacker.invalid/pixel">');

  // Filter reader articles with malicious category query matches exactly
  const articles = [
    { identity: "1", feedUrl: "https://example.com/feed.xml", title: "<script>bad()</script>", category: '<img src="https://attacker.invalid/pixel">' }
  ];
  const matched = Model.filterReaderArticles(articles, {
    category: '<img src="https://attacker.invalid/pixel">',
    subscriptions: result.newSubscriptions
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0].title, "<script>bad()</script>");
});

test("all QML text rendering components with dynamic/untrusted data explicitly declare Text.PlainText", () => {
  const qmlFiles = [
    "ArticleRow.qml",
    "CategoryDrawer.qml",
    "ReaderView.qml",
    "SettingsView.qml",
    "SubscriptionsView.qml",
    "SearchField.qml",
  ];

  const dynamicBindings = [
    /text\s*:\s*root\.item\./,
    /text\s*:\s*modelData\./,
    /text\s*:\s*root\.currentCategory/,
    /text\s*:\s*root\.selectedCategory/,
    /text\s*:\s*root\.shareStatus/,
    /text\s*:\s*root\.statusMessage/,
    /text\s*:\s*root\.emptyCopy/,
    /text\s*:\s*root\.searchQuery/,
    /text\s*:\s*root\.placeholderText/,
    /text\s*:\s*\{[^}]*root\.(categoryName|item|subscriptions|shareStatus|statusMessage|emptyCopy|searchQuery|currentPage|totalFilteredCount)/s,
  ];

  for (const file of qmlFiles) {
    const filePath = path.join(rootDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const textBlocks = extractQmlBlocks(content, "Text");

    for (const block of textBlocks) {
      const isDynamic = dynamicBindings.some((pattern) => pattern.test(block.content));
      if (isDynamic) {
        assert.match(
          block.content,
          /textFormat\s*:\s*Text\.PlainText/,
          `Dynamic Text element in ${file} must specify textFormat: Text.PlainText.\nBlock:\n${block.content}`
        );
      }

      // Ensure no dynamic or untrusted text element uses AutoText, RichText, or StyledText
      if (isDynamic) {
        assert.doesNotMatch(
          block.content,
          /textFormat\s*:\s*Text\.(AutoText|RichText|StyledText)/,
          `Text element in ${file} must not use AutoText, RichText, or StyledText.\nBlock:\n${block.content}`
        );
      }
    }
  }
});

test("specific critical UI elements have Text.PlainText verified", () => {
  const checks = [
    { file: "ArticleRow.qml", target: 'root.item.title || "Untitled"' },
    { file: "ArticleRow.qml", target: "root.categoryName" },
    { file: "CategoryDrawer.qml", target: 'modelData.name || "All"' },
    { file: "ReaderView.qml", target: "root.currentCategory.toLowerCase()" },
    { file: "ReaderView.qml", target: "root.searchQuery" },
    { file: "SettingsView.qml", target: "root.shareStatus" },
    { file: "SubscriptionsView.qml", target: "root.statusMessage" },
    { file: "SubscriptionsView.qml", target: "root.selectedCategory ? root.selectedCategory" },
    { file: "SubscriptionsView.qml", target: "modelData.display" },
    { file: "SubscriptionsView.qml", target: "modelData.title || modelData.url" },
    { file: "SubscriptionsView.qml", target: "modelData.url" },
    { file: "SubscriptionsView.qml", target: "modelData.category ? modelData.category" },
  ];

  for (const check of checks) {
    const filePath = path.join(rootDir, check.file);
    const content = fs.readFileSync(filePath, "utf-8");
    const blocks = extractQmlBlocks(content, "Text");
    const matchingBlock = blocks.find((b) => b.content.includes(check.target));
    assert.ok(matchingBlock, `Could not find Text block matching "${check.target}" in ${check.file}`);
    assert.match(
      matchingBlock.content,
      /textFormat\s*:\s*Text\.PlainText/,
      `Text block for "${check.target}" in ${check.file} missing textFormat: Text.PlainText`
    );
  }
});
