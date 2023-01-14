import { clsx } from "clsx";

export default function LinkedInLink() {
	return (
		<a
			href="https://www.linkedin.com/in/redfield1990/"
			class={clsx([
				"inline-flex h-12 px-4 items-center",
				"rounded",
				"bg-blue-700 hover:bg-blue-800",
				"text-white text-xl",
				"active:translate-y-1 transition-all",
			])}
		>
			My LinkedIn profile
		</a>
	);
}
