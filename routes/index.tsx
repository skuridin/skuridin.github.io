/** @jsx h */
import { Fragment, h } from "preact";
import { tw } from "@twind";
import PageMeta from "@features/intro/PageMeta/PageMeta.tsx";
import About from "@features/intro/About/About.tsx";
import Skills from "@features/intro/Skills/Skills.tsx";
import LinkedInLink from "@features/intro/LinkedInLink/LinkedInLink.tsx";

const SKILLS = ["GraphQL", "React", "TypeScript"];

export default function Home() {
	return (
		<Fragment>
			<PageMeta skills={SKILLS} />

			<div class={tw`h-screen flex justify-center items-center`}>
				<main class={tw`p-4 pb-32`}>
					<About />
					<Skills skills={SKILLS} />
					<LinkedInLink />
				</main>
			</div>
		</Fragment>
	);
}
