import { clsx } from "clsx";

export default function About() {
	return (
		<h1
			class={clsx([
				"text-3xl bg-clip-text text-transparent",
				"bg-gradient-to-br from-red-600 to-blue-600 bg-right",
				"transition-all duration-500",
				"hover:bg-left",
			])}
			style={{
				backgroundSize: "400%",
			}}
		>
			Hi, <br />
			I'm Eugene, <br />
			Frontend Developer <br />
			Based in the Netherlands
		</h1>
	);
}
