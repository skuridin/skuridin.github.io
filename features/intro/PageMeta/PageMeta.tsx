import { Head } from "$fresh/runtime.ts";

type PageMetaProps = {
	skills: Readonly<string[]>;
};

export default function PageMeta({ skills }: PageMetaProps) {
	const listFormat = new Intl.ListFormat("en-us", { type: "unit" });
	const description =
		`Eugene Skuridin — Frontend developer located in the Netherlands. ${
			listFormat.format(skills)
		}`;

	return (
		<Head>
			<title>Eugene Skuridin — Frontend Developer</title>
			<meta name="description" content={description} />
			<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		</Head>
	);
}
