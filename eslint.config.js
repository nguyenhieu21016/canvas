export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        alert: "readonly",
        prompt: "readonly",
        confirm: "readonly",
        URL: "readonly",
        Blob: "readonly",
        File: "readonly",
        FormData: "readonly",
        Promise: "readonly",
        crypto: "readonly",
        Math: "readonly",
        JSON: "readonly",
        Event: "readonly",
        Array: "readonly",
        Object: "readonly",
        String: "readonly",
        Number: "readonly",
        Boolean: "readonly",
        Date: "readonly",
        require: "readonly",
        module: "readonly",
        process: "readonly",
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  }
];
