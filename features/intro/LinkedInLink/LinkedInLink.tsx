/** @jsx h */
import { h } from "preact";
import { tw } from "@twind";

export default function LinkedInLink() {
	return (
		<a
			href="https://www.linkedin.com/in/redfield1990/"
			class={tw
				`mt-5 inline-flex text-white rounded bg-blue-700 hover:bg-blue-800 h-12 px-4 items-center text-xl`}
		>
			Contact me on LinkedIn
		</a>
	);
}
