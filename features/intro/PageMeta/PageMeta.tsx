import { Head } from "$fresh/runtime.ts";

type PageMetaProps = {
	skills: Readonly<string[]>;
};

export default function PageMeta({ skills }: PageMetaProps) {
	const description =
		`Eugene Skuridin — Frontend developer located in the Netherlands. ${
			skills.join(", ")
		}`;

	return (
		<Head>
			<title>Eugene Skuridin — Frontend Developer</title>
			<meta name="description" content={description} />
			<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		</Head>
	);
}
