const js = require("@eslint/js");

module.exports = [
    js.configs.recommended,
    {
        files: ["src/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                // Browser standard
                window: "readonly",
                document: "readonly",
                console: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                MutationObserver: "readonly",
                ResizeObserver: "readonly",
                Image: "readonly",
                HTMLElement: "readonly",
                EyeDropper: "readonly",
                fetch: "readonly",
                navigator: "readonly",
                location: "readonly",
                performance: "readonly",
                getComputedStyle: "readonly",
                requestAnimationFrame: "readonly",
                CustomEvent: "readonly",
                Event: "readonly",
                alert: "readonly",
                // Web APIs
                Blob: "readonly",
                TextEncoder: "readonly",
                TextDecoder: "readonly",
                FileReader: "readonly",
                FormData: "readonly",
                // Service Worker
                importScripts: "readonly",
                self: "readonly",
                // Chrome Extension
                chrome: "readonly",
                globalThis: "readonly",
            },
        },
        rules: {
            "no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            }],
            "no-undef": "error",
            "no-console": "off",
            "no-duplicate-case": "error",
            "no-unreachable": "error",
            "no-constant-condition": "warn",
            "no-empty": ["warn", { allowEmptyCatch: true }],
            "no-useless-escape": "warn",
            "eqeqeq": ["warn", "always"],
        },
    },
];
