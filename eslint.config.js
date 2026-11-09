// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");
const prettier = require("eslint-config-prettier");

module.exports = defineConfig([
    {
        ignores: [
            "dist/",
            ".angular/",
            "playwright-report/",
            "test-results/",
            // Vendored from az-ui; changed upstream, not here.
            "src/vendor/",
        ],
    },
    {
        files: ["**/*.ts"],
        extends: [
            eslint.configs.recommended,
            tseslint.configs.strict,
            tseslint.configs.stylistic,
            angular.configs.tsRecommended,
            prettier,
        ],
        processor: angular.processInlineTemplates,
        rules: {
            "@angular-eslint/directive-selector": [
                "error",
                { type: "attribute", prefix: "app", style: "camelCase" },
            ],
            "@angular-eslint/component-selector": [
                "error",
                { type: "element", prefix: "app", style: "kebab-case" },
            ],
            "@angular-eslint/prefer-on-push-component-change-detection":
                "error",
            "@angular-eslint/prefer-signals": "error",
            "@typescript-eslint/explicit-member-accessibility": [
                "error",
                { accessibility: "no-public" },
            ],
        },
    },
    {
        // The engine is plain TypeScript: it must stay usable without Angular.
        files: ["src/engine/**/*.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@angular/*", "rxjs", "rxjs/*"],
                            message:
                                "src/engine must not depend on Angular or RxJS.",
                        },
                        {
                            group: ["**/app/**", "../app/*"],
                            message: "src/engine must not import from src/app.",
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ["**/*.html"],
        extends: [
            angular.configs.templateRecommended,
            angular.configs.templateAccessibility,
        ],
        rules: {
            "@angular-eslint/template/prefer-control-flow": "error",
            "@angular-eslint/template/prefer-self-closing-tags": "error",
        },
    },
]);
