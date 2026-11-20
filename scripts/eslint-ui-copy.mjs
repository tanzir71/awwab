import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = JSON.parse(readFileSync(new URL("./ui-copy-baseline.json", import.meta.url), "utf8"));
const userFacingAttributes = new Set([
  "alt", "aria-description", "aria-label", "aria-valuetext", "children",
  "description", "emptyText", "errorMessage", "label", "loadingText", "placeholder", "title", "tooltip",
]);

export default {
  rules: {
    "translate-visible-text": {
      meta: {
        type: "problem",
        messages: { translate: "Move visible text {{text}} into the UI catalogue and render it through translated copy." },
      },
      create(context) {
        const file = relative(root, context.filename).replaceAll("\\", "/");
        const existing = new Map(Object.entries(baseline[file] ?? {}));

        function report(node, value) {
          const text = value.trim().replace(/\s+/gu, " ");
          if (!/\p{L}/u.test(text)) return;
          const remaining = existing.get(text) ?? 0;
          if (remaining > 0) {
            existing.set(text, remaining - 1);
            return;
          }
          context.report({ node, messageId: "translate", data: { text: JSON.stringify(text) } });
        }

        function inspect(node) {
          if (!node) return;
          switch (node.type) {
            case "Literal":
              if (typeof node.value === "string") report(node, node.value);
              break;
            case "TemplateLiteral":
              report(node, node.quasis.map(part => part.value.cooked ?? part.value.raw).join("${…}"));
              break;
            case "ConditionalExpression":
              inspect(node.consequent);
              inspect(node.alternate);
              break;
            case "LogicalExpression":
              if (node.operator !== "&&") inspect(node.left);
              inspect(node.right);
              break;
            case "BinaryExpression":
              if (node.operator === "+") {
                inspect(node.left);
                inspect(node.right);
              }
              break;
            case "ArrayExpression":
              node.elements.forEach(inspect);
              break;
            case "TSAsExpression":
            case "TSSatisfiesExpression":
            case "TSNonNullExpression":
            case "TSTypeAssertion":
              inspect(node.expression);
              break;
          }
        }

        return {
          JSXText: node => report(node, node.value),
          "JSXElement > JSXExpressionContainer, JSXFragment > JSXExpressionContainer": node => inspect(node.expression),
          JSXAttribute(node) {
            if (!userFacingAttributes.has(node.name.name)) return;
            inspect(node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value);
          },
        };
      },
    },
  },
};
