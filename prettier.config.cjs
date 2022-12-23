/** @type { import('prettier').Config } */
module.exports = {
	plugins: [require.resolve("prettier-plugin-astro")],
	useTabs: true,

	overrides: [
		{
			files: "*.astro",
			options: {
				parser: "astro",
			},
		},
		{
			files: ["*.json", "*.yml", "*.yaml"],
			options: {
				useTabs: false,
			},
		},
	],
};
