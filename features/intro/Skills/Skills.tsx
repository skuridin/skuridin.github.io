type SkillsProps = {
	skills: Readonly<string[]>;
};

export default function Skills({ skills }: SkillsProps) {
	return (
		<ul class="flex items-center gap-x-2 mt-4" aria-label="My primary skills">
			{skills.map((skill) => (
				<li
					key={skill}
					class="inline-flex rounded-full px-2 h-6 border items-center text-xs"
				>
					{skill}
				</li>
			))}
		</ul>
	);
}
