const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

module.exports = [
    ...compat.extends("eslint-config-next/core-web-vitals"),
    ...compat.extends("eslint-config-next/typescript"),
    {
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        }
    },
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            "out/**",
            "build/**",
            "next-env.d.ts",
        ],
    },
];
