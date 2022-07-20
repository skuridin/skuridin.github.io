/** @jsx h */
import { h } from "preact";
import { tw } from "@twind";

type Props = {
	skills: string[];
};

export default function Skills({ skills }: Props) {
	if (skills.length === 0) {
		return null;
	}

	return (
		<ul class={tw`flex items-center gap-x-2 mt-4`}>
			{skills.map((skill) => (
				<li
					key={skill}
					class={tw
						`inline-flex rounded-full px-2 h-6 border items-center text-xs`}
				>
					{skill}
				</li>
			))}
		</ul>
	);
}
