import { z } from "zod";

const str = "rodrigo,rio de janeiro,rj,[1:grande,231]";

const pattern = /^(?<name>[^,]+),(?<city>[^,]+),(?<estado>[^,]+),\[(?<casaCount>\d+):(?<casaElements>[^\]]+)\]$/;

function parseResidencia<T>(input: string): T {
	const schema = respostaSchema as z.ZodType<T>;
	const match = input.match(pattern);

	if (!match) {
		throw new Error("Formato inválido para a string de entrada.");
	}

	const { name, city, estado, casaCount, casaElements } = match.groups as Record<string, string>;

console.log(casaElements);

	const elementosCasa = casaElements
		.split("|")
		.map((item) => item.trim())
		.filter(Boolean);

	const quantidadeCasa = Number(casaCount);

	if (quantidadeCasa !== elementosCasa.length) {
		console.warn(
			`Aviso: quantidade declarada (${quantidadeCasa}) difere do número de itens encontrados (${elementosCasa.length}).`
		);
	}

	const resultado = {
		name,
		city,
		estado,
		casas: elementosCasa.map((item) => {
			const [tamanho, numero] = item.split(",").map((part) => part.trim());
			return { tamanho, numero };
		}),
	};

	return schema.parse(resultado);
}

type Resposta = {
	name: string;
	city: string;
	estado: string;
	casas: {
		tamanho: string;
		numero: string
	}[];
};

const respostaSchema: z.ZodType<Resposta> = z.object({
	name: z.string().min(1, "Nome é obrigatório"),
	city: z.string().min(1, "Cidade é obrigatória"),
	estado: z.string().length(2, "Estado deve ter 2 caracteres").or(z.string().min(1)),
	casas: z
		.array(
			z.object({
				tamanho: z.string().min(1, "Tamanho é obrigatório"),
				numero: z.string().min(1, "Número é obrigatório")
			})
		)
		.nonempty("Ao menos uma casa deve ser informada"),
});

type RespostaSchema = z.infer<typeof respostaSchema>;

const resposta = parseResidencia<RespostaSchema>(str);

console.log(JSON.stringify(resposta, null, 2));

