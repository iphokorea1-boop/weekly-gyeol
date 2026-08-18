import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function inDays(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  await prisma.taskCompletion.deleteMany();
  await prisma.task.deleteMany();

  await prisma.task.createMany({
    data: [
      // 정기 루틴
      {
        title: "기상 루틴",
        weekdays: "0,1,2,3,4,5,6",
        startTime: "06:00",
        endTime: "06:30",
        priority: 1,
      },
      {
        title: "헬스장",
        weekdays: "1,3,5",
        startTime: "07:00",
        endTime: "08:00",
        priority: 1,
      },
      {
        title: "집중 공부",
        weekdays: "2,4",
        startTime: "20:00",
        endTime: "22:00",
        priority: 2,
      },
      {
        title: "저녁 산책",
        weekdays: "0,1,2,3,4,5,6",
        startTime: "21:00",
        endTime: "21:30",
        priority: 0,
      },
      // 날짜 있는 할 일
      {
        title: "과제 제출",
        dueDate: inDays(0),
        startTime: "14:00",
        priority: 2,
      },
      {
        title: "병원 예약",
        dueDate: inDays(1),
        startTime: "10:30",
        priority: 1,
      },
      {
        title: "스터디 모임",
        dueDate: inDays(3),
        startTime: "15:00",
        endTime: "16:30",
        priority: 1,
      },
      // 언젠가 할 일 (미배치)
      { title: "세금 신고 서류 준비", priority: 1 },
      { title: "자전거 정비 맡기기", priority: 0 },
      { title: "겨울옷 정리", priority: 0 },
    ],
  });

  console.log("Seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
