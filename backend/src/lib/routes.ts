import { FastifyInstance } from "fastify";
import { prisma } from "./prisma";
import { z } from "zod";
import dayjs from "dayjs";

export async function appRoutes(app: FastifyInstance) {
  app.post("/habits", async (request) => {
    const createHabitBody = z.object({
      title: z.string(),
      WeekDays: z.array(z.number().min(0).max(6)),
    });

    const { title, WeekDays } = createHabitBody.parse(request.body);

    const today = dayjs().startOf("day").toDate();

    await prisma.habit.create({
      data: {
        title,
        created_at: today,
        WeekDays: {
          create: WeekDays.map((WeekDay) => {
            return {
              week_day: WeekDay,
            };
          }),
        },
      },
    });
  });

  app.get("/day", async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date(),
    });

    const { date } = getDayParams.parse(request.query);
    const parseDate = dayjs(date).startOf("day");
    const WeekDay = parseDate.get("day");

    // todos hábitos possíveis
    // hábitos que já foram completados

    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at: {
          lte: date,
        },
        WeekDays: {
          some: {
            week_day: WeekDay,
          },
        },
      },
    });

    const day = await prisma.day.findUnique({
      where: {
        date: parseDate.toDate(),
      },
      include: {
        DayHabits: true,
      },
    });

    const completedHabits = day?.DayHabits.map((dayHabit) => {
      return dayHabit.habit_id;
    });

    return {
      possibleHabits,
      completedHabits,
    };
  });

  // completar / não-completar um hábito

  app.patch("/habits/:id/toggle", async (request) => {
    //route param => parâmetro de identificação

    const toggleHabitsParams = z.object({
      id: z.string().uuid(),
    });

    const { id } = toggleHabitsParams.parse(request.params);

    const today = dayjs().startOf("day").toDate();

    let day = await prisma.day.findUnique({
      where: {
        date: today,
      },
    });

    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today,
        },
      });
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id,
        },
      },
    });

    if (dayHabit) {
      // Remover a marcação de completo
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id,
        },
      });
    } else {
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id,
        },
      });
    }

    // Completar o hábito nesse dia
    await prisma.dayHabit.create({
      data: {
        day_id: day.id,
        habit_id: id,
      },
    });
  });


  app.get("summary", async () => {
  })
}
