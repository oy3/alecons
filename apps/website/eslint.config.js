import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.{js,vue,mjs}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: { document: "readonly", window: "readonly", sessionStorage: "readonly", requestAnimationFrame: "readonly", fetch: "readonly", IntersectionObserver: "readonly", process: "readonly" } },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/max-attributes-per-line": "off",
      "vue/html-self-closing": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-indent": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/order-in-components": "off",
    },
  },
];
