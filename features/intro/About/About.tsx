/** @jsx h */
import { h } from "preact";
import { tw } from "@twind";

export default function About() {
	return (
		<h1 class={tw`text-3xl relative bg-white overflow-hidden`}>
			Hi, <br />
			I'm Evgeniy, <br />
			Frontend Developer <br />
			based in the Netherlands.
			<span
				aria-hidden="true"
				class={tw
					`inline-flex absolute inset-0 bg-gradient-to-b from-red-600 to-blue-600 pointer-events-none mix-blend-lighten`}
			/>
		</h1>
	);
}
