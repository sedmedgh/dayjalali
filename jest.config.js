module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    transform: {
        "^.+\\.[t|j]sx?$": ["babel-jest", { configFile: './babel.config.js' }]
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    extensionsToTreatAsEsm: ['.ts'],
    transformIgnorePatterns: [],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    }
}