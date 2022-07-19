/** @jsx h */
import { Fragment, h } from "preact";
import { apply, tw } from "@twind";
import { Head } from "$fresh/runtime.ts";

const SKILLS = ["GraphQL", "React", "TypeScript"];
const skillBadgeStyles = apply
	`inline-flex bg-black text-white rounded px-2 py-1`;

export default function Home() {
	return (
		<Fragment>
			<Head>
				<title>E. Skuridin — Frontend Developer</title>
				<meta
					name="description"
					content={`Frontend developer located in the Netherlands. ${
						SKILLS.join(", ")
					}.`}
				/>
			</Head>

			<div class={tw`h-screen flex justify-center items-center p-4 pb-24`}>
				<div>
					<h1 class={tw`text-3xl relative bg-white overflow-hidden`}>
						Hi, <br />
						I'm Evgeniy, <br />
						Frontend Developer <br />
						located in the Netherlands.
						<span
							class={tw
								`inline-flex absolute inset-0 bg-gradient-to-r from-red-600 to-blue-600 pointer-events-none mix-blend-lighten`}
						/>
					</h1>
					<ul class={tw`flex items-center gap-x-4 mt-4 pt-4 border-t-1`}>
						{SKILLS.map((skill) => (
							<li key={skill} class={tw`${skillBadgeStyles}`}>{skill}</li>
						))}
					</ul>
					<div class={tw`mt-4 pt-4 border-t-1`}>
						You can find me on{" "}
						<a
							href="https://www.linkedin.com/in/redfield1990/"
							class={tw`underline text-blue-400 hover:text-blue-800`}
						>
							LinkedIn
						</a>
					</div>
				</div>
			</div>
		</Fragment>
	);
}
