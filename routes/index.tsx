/** @jsx h */
import { Fragment, h } from "preact";
import { apply, tw } from "@twind";
import { Head } from "$fresh/runtime.ts";

const SKILLS = ["GraphQL", "React", "TypeScript"];

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
						based in the Netherlands.
						<span
							class={tw
								`inline-flex absolute inset-0 bg-gradient-to-b from-red-600 to-blue-600 pointer-events-none mix-blend-lighten`}
						/>
					</h1>
					<ul class={tw`flex items-center gap-x-4 mt-4 pt-4 border-t-1`}>
						{SKILLS.map((skill) => (
							<li
								key={skill}
								class={tw
									`inline-flex rounded px-2 h-6 bg-gray-100 items-center text-xs`}
							>
								{skill}
							</li>
						))}
					</ul>
					<div class={tw`mt-4 pt-4 border-t-1`}>
						<a
							href="https://www.linkedin.com/in/redfield1990/"
							class={tw
								`inline-flex text-white rounded bg-blue-700 hover:bg-blue-800 h-10 px-4 items-center`}
						>
							Contact me on LinkedIn
						</a>
					</div>
				</div>
			</div>
		</Fragment>
	);
}
