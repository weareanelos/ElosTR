import { z } from "zod";

type SchemaShape = Record<string, z.ZodTypeAny>;

type RegexField =
	| {
		kind: "scalar";
		key: string;
	}
	| {
		kind: "array";
		key: string;
		itemKeys: string[] | null;
	};

type RegexBlueprint = {
	pattern: RegExp;
	fields: RegexField[];
};

function buildRegexFromSchema(schema: z.ZodObject<SchemaShape>): RegexBlueprint {
	const entries = Object.entries(schema.shape);
	const regexParts: string[] = [];
	const fields: RegexField[] = [];

	entries.forEach(([key, value]) => {
		if (value instanceof z.ZodArray) {
			const elementSchema = value.element;
			const itemKeys = elementSchema instanceof z.ZodObject ? Object.keys(elementSchema.shape) : null;
			regexParts.push(`\\[(?<${key}Count>\\d+):(?<${key}Elements>[^\\]]+)\\]`);
			fields.push({ kind: "array", key, itemKeys });
			return;
		}

		regexParts.push(`(?<${key}>[^,]+)`);
		fields.push({ kind: "scalar", key });
	});

	if (!regexParts.length) {
		throw new Error("Schema precisa ter ao menos um campo para gerar o regex.");
	}

	const regexBody = regexParts.join(",");
	return {
		pattern: new RegExp(`^${regexBody}$`),
		fields,
	};
}

function parseBySchema<T extends z.ZodObject<SchemaShape>>(input: string, schema: T): z.infer<T> {
	const { pattern, fields } = buildRegexFromSchema(schema);
	const match = input.match(pattern);

	if (!match?.groups) {
		throw new Error("Formato inválido para a string de entrada.");
	}

	const result: Record<string, unknown> = {};

	fields.forEach((field) => {
		if (field.kind === "scalar") {
			result[field.key] = match.groups?.[field.key]?.trim() ?? "";
			return;
		}

		const elementsGroup = match.groups?.[`${field.key}Elements`] ?? "";
		const declaredCount = Number(match.groups?.[`${field.key}Count`] ?? "0");
		const rawItems = elementsGroup
			.split("|")
			.map((chunk) => chunk.trim())
			.filter((chunk) => chunk.length > 0);

		let parsedItems: unknown[];

		if (field.itemKeys && field.itemKeys.length) {
			parsedItems = rawItems.map((chunk, index) => {
				const values = chunk.split(",").map((value) => value.trim());
				const element: Record<string, unknown> = {};

				field.itemKeys?.forEach((key, keyIndex) => {
					element[key] = values[keyIndex] ?? "";
				});

				if (values.length !== field.itemKeys?.length) {
					console.warn(
						`Item ${index + 1} do array "${field.key}" possui ${values.length} valores, esperado ${field.itemKeys?.length}.`
					);
				}

				return element;
			});
		} else {
			parsedItems = rawItems;
		}

		if (declaredCount !== parsedItems.length) {
			console.warn(
				`Aviso: quantidade declarada (${declaredCount}) difere do número de itens encontrados (${parsedItems.length}) para o campo "${field.key}".`
			);
		}

		result[field.key] = parsedItems;
	});

	return schema.parse(result);
}

const respostaSchema = z.object({
	name: z.string().min(1, "Nome é obrigatório"),
	city: z.string().min(1, "Cidade é obrigatória"),
	estado: z.string().length(2, "Estado deve ter 2 caracteres").or(z.string().min(1)),
	casas: z
		.array(
			z.object({
				tamanho: z.string().min(1, "Tamanho é obrigatório"),
				numero: z.string().min(1, "Número é obrigatório"),
			})
		)
		.nonempty("Ao menos uma casa deve ser informada"),
	tags: z.array(z.string().min(1, "Tag é obrigatória")).nonempty("Ao menos uma tag deve ser informada"),
});

const str = "rodrigo,rio de janeiro,rj,[2:grande,231|média,78],[3:quintal|garagem|piscina]";

const resposta = parseBySchema(str, respostaSchema);

console.log(JSON.stringify(resposta, null, 2));

