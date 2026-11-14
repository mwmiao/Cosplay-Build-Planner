import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import jsxA11y from "eslint-plugin-jsx-a11y";

// Same rules as the old .eslintrc.json.
export default [
  { ignores: ["node_modules/", ".next/", "data/", "dist/", "test-results/", "prisma/", "public/"] },
  ...nextCoreWebVitals,
  { rules: jsxA11y.flatConfigs.recommended.rules }, // the plugin itself is already registered by eslint-config-next
  {
    rules: {
      // Labels that wrap a checkbox and its text in nested spans are fine; look three levels deep for the text.
      "jsx-a11y/label-has-associated-control": ["error", { assert: "either", depth: 3 }],
      // Images are already resized thumbnails served by the app's own routes; next/image would add nothing.
      "@next/next/no-img-element": "off",
      // New in eslint-config-next 16 (React Compiler checks). They flag existing, working components;
      // left off so this upgrade changes no component code. Revisit separately.
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
