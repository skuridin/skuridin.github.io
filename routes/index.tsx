import PageMeta from "@features/intro/PageMeta/PageMeta.tsx";
import About from "@features/intro/About/About.tsx";
import Skills from "@features/intro/Skills/Skills.tsx";
import LinkedInLink from "@features/intro/LinkedInLink/LinkedInLink.tsx";

const SKILLS = ["GraphQL", "React", "TypeScript"];

export default function Home() {
	return (
		<>
			<PageMeta skills={SKILLS} />

			<div class="h-screen flex justify-center items-center">
				<main class="p-4 pb-32">
					<About />
					<Skills skills={SKILLS} />
					<LinkedInLink />
				</main>
			</div>
		</>
	);
}
