import { z } from "zod";

const str = "rodrigo,rio de janeiro,rj,[2:grande,231|média,78]";

type SchemaShape = Record<string, z.ZodTypeAny>;

type RegexBlueprint = {
	pattern: RegExp;
	scalarKeys: string[];
	arrayKey: string;
	arrayItemKeys: string[];
};

function buildRegexFromSchema(schema: z.ZodObject<SchemaShape>): RegexBlueprint {
	const entries = Object.entries(schema.shape);

	console.log("Schema entries:", entries);

	const arrayEntries = entries.filter(([, value]) => value instanceof z.ZodArray);

	console.log("Array entries:", arrayEntries);

	if (arrayEntries.length !== 1) {
		throw new Error("Schema deve conter exatamente um campo do tipo array para o formato suportado.");
	}

	const [[arrayKey, arraySchema]] = arrayEntries as [
		[string, z.ZodArray<z.ZodTypeAny>]
	];
	const scalarKeys = entries.filter(([, value]) => !(value instanceof z.ZodArray)).map(([key]) => key);
	const itemSchema = arraySchema.element;

	if (!(itemSchema instanceof z.ZodObject)) {
		throw new Error("O array do schema deve conter objetos como itens.");
	}

	const arrayItemKeys = Object.keys(itemSchema.shape);
	const scalarPattern = scalarKeys.map((key) => `(?<${key}>[^,]+)`).join(",");
	const arrayPattern = `\\[(?<${arrayKey}Count>\\d+):(?<${arrayKey}Elements>[^\\]]+)\\]`;
	const regexBody = [scalarPattern, arrayPattern].filter(Boolean).join(",");

	return {
		pattern: new RegExp(`^${regexBody}$`),
		scalarKeys,
		arrayKey,
		arrayItemKeys,
	};
}

function parseBySchema<T extends z.ZodObject<SchemaShape>>(input: string, schema: T): z.infer<T> {
	const { pattern, scalarKeys, arrayKey, arrayItemKeys } = buildRegexFromSchema(schema);
	const match = input.match(pattern);

	if (!match?.groups) {
		throw new Error("Formato inválido para a string de entrada.");
	}

	const result: Record<string, unknown> = {};

	scalarKeys.forEach((key) => {
		result[key] = match.groups?.[key]?.trim() ?? "";
	});

	const arrayElementsGroup = match.groups?.[`${arrayKey}Elements`] ?? "";
	const declaredCount = Number(match.groups?.[`${arrayKey}Count`] ?? "0");
	const arrayItems = arrayElementsGroup
		.split("|")
		.map((chunk) => chunk.trim())
		.filter(Boolean)
		.map((chunk, index) => {
			const values = chunk.split(",").map((value) => value.trim());
			const element: Record<string, unknown> = {};

			arrayItemKeys.forEach((key, keyIndex) => {
				element[key] = values[keyIndex] ?? "";
			});

			if (values.length !== arrayItemKeys.length) {
				console.warn(
					`Item ${index + 1} do array "${arrayKey}" possui ${values.length} valores, esperado ${arrayItemKeys.length}.`
				);
			}

			return element;
		});

	if (declaredCount !== arrayItems.length) {
		console.warn(
			`Aviso: quantidade declarada (${declaredCount}) difere do número de itens encontrados (${arrayItems.length}).`
		);
	}

	result[arrayKey] = arrayItems;

	return schema.parse(result);
}

type Resposta = {
	name: string;
	city: string;
	estado: string;
	casas: {
		tamanho: string;
		numero: string;
	}[];
};

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
});

type RespostaSchema = z.infer<typeof respostaSchema>;

const resposta = parseBySchema(str, respostaSchema);

console.log(JSON.stringify(resposta, null, 2));

