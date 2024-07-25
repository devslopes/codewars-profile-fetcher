import { z } from "zod";

const args = Bun.argv;
if (args.length < 2) {
  throw new Error(`
  Must Provide Profile Name like this 
  "bun run get-data Jonathan.higger"
`);
}

const profileName = args.at(-1);

console.log(`FETCHING THE DATA FOR ${profileName}`);

const assignmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  completedLanguages: z.array(z.string()),
  completedAt: z.string(),
});

type Assignment = z.infer<typeof assignmentSchema>;

const responseSchema = z.object({
  totalPages: z.number(),
  totalItems: z.number(),
  data: z.array(assignmentSchema).optional(),
});

const urlWithPage = (page: number, profile: string) =>
  `https://www.codewars.com/api/v1/users/${profile}/code-challenges/completed?page=${page}`;

const getAllAssignmentsForUser = async (
  profileName: string,
  page: number = 0,
  prevAssignments: Assignment[] = [],
) => {
  const result = await fetch(urlWithPage(page, profileName))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Could not get data for ${profileName}`);
      }
      return response;
    })
    .then((response) => response.json())
    .then(responseSchema.parse);

  if (result.totalPages - 1 === page) {
    return [...prevAssignments, ...(result?.data ?? [])];
  }

  return getAllAssignmentsForUser(profileName, page + 1, result.data ?? []);
};

const deepAssignmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  category: z.string(),
  publishedAt: z.string(),
  // approvedAt: z.string(),
  rank: z.object({
    id: z.number(),
    name: z.string(),
    color: z.string(),
  }),
});
const getAllAssignmentData = (assignmentSlug: string) =>
  fetch(`https://www.codewars.com/api/v1/code-challenges/${assignmentSlug}`)
    .then((response) => response.json())
    .then(deepAssignmentSchema.parse);

const allAssignments = await Promise.all(
  (await getAllAssignmentsForUser(profileName)).map((assignment) =>
    getAllAssignmentData(assignment.slug),
  ),
);

let assignmentMap = allAssignments.reduce<
  Record<string, { count: number; names: string[] }>
>((acc, assignment) => {
  return {
    ...acc,
    [assignment.rank.name]: {
      count: (acc[assignment.rank.name]?.count ?? 0) + 1,
      names: [...(acc[assignment.rank.name]?.names ?? []), assignment.name],
    },
  };
}, {});

await Bun.write(
  `students/${profileName}/${new Date(Date.now()).toString()}.json`,
  JSON.stringify(assignmentMap, null, 2),
  {
    createPath: true,
  },
);
