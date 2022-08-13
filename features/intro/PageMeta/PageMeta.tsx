/** @jsx h */
import { h } from "preact";
import { Head } from "$fresh/runtime.ts";

type Props = {
	skills: string[];
};

export default function PageMeta({ skills }: Props) {
	const skillsString = skills.length > 0 ? ` ${skills.join(", ")}.` : "";

	return (
		<Head>
			<title>Eugene Skuridin — Frontend Developer</title>
			<meta
				name="description"
				content={`Eugene Skuridin — Frontend developer located in the Netherlands.${skillsString}`}
			/>
		</Head>
	);
}
