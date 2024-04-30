const fs = require("fs");
const { authorMap } = require("./config/config");

const gitLog = fs.readFileSync("../tmp/all_logs_all_refs.txt", "utf8");

function parseGitLog(gitLog) {
  const lines = gitLog.split("\n");
  const commits = [];
  let lastCommit = null;

  lines.forEach((line) => {
    if (
      line.match(
        /:(\w+):([^:]+):(\w+ \w+ \s?\d+ \d+:\d+:\d+ \d+ [+-]\d+):([\s\S]+)/
      )
    ) {
      const parts = line.match(
        /:(\w+):([^:]+?):(\w+ \w+ \s?\d+ \d+:\d+:\d+ \d+ [+-]\d+):([\s\S]+)/
      );

      if (parts) {
        const [, hash, author, date, message] = parts;
        lastCommit = {
          hash,
          author: author.trim(),
          date: new Date(date),
          message: message.trim(),
          insertions: 0,
        };
      }
    } else if (line.match(/\d+ file[s]? changed,/)) {
      if (lastCommit) {
        const changeDetails = line.match(/(\d+) insertion[s]?\(\+\)/);
        const deletionDetails = line.match(/(\d+) deletion[s]?\(-\)/);

        lastCommit.insertions = changeDetails
          ? parseInt(changeDetails[1], 10)
          : 0;
        lastCommit.deletions = deletionDetails
          ? parseInt(deletionDetails[1], 10)
          : 0;

        commits.push(lastCommit);
        lastCommit = null;
      }
    }
  });

  return commits;
}

function aggregateData(commits) {
  const data = {};

  commits.forEach(({ author, date, insertions }) => {
    const dateString = date.toISOString().split("T")[0];

    if (!data[dateString]) {
      data[dateString] = {};
    }
    if (!data[dateString][author]) {
      data[dateString][author] = 0;
    }
    data[dateString][author] += insertions;
  });

  return data;
}

function fillMissingDates(data) {
  const dates = Object.keys(data).sort();
  const firstDate = new Date(dates[0]);
  const lastDate = new Date(dates[dates.length - 1]);
  let currentDate = firstDate;

  while (currentDate <= lastDate) {
    const dateString = currentDate.toISOString().split("T")[0];
    if (!data[dateString]) {
      data[dateString] = {};
      Object.keys(data[dates[0]]).forEach((author) => {
        data[dateString][author] = 0;
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

function mergeAuthors(data, authorMap) {
  const newData = {};

  Object.keys(data).forEach((date) => {
    if (!newData[date]) {
      newData[date] = {};
    }

    Object.keys(data[date]).forEach((author) => {
      const newAuthor = authorMap[author] || author;

      if (!newData[date][newAuthor]) {
        newData[date][newAuthor] = 0;
      }

      newData[date][newAuthor] += data[date][author];
    });
  });

  return newData;
}

function createTable(data) {
  const dates = Object.keys(data).sort((a, b) => new Date(b) - new Date(a));
  const authors = Array.from(
    new Set(dates.flatMap((date) => Object.keys(data[date])))
  ).sort();

  let table = '<table border="1"><tr><th>Date</th>';
  authors.forEach((author) => (table += `<th>${author}</th>`));
  table += "</tr>";

  dates.forEach((date) => {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const formattedDate = `${date} ${dayOfWeek}`;
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const rowColor = isWeekend ? ' style="color:#770000;"' : "";

    table += `<tr><td${rowColor}>${formattedDate}</td>`;
    authors.forEach((author) => {
      const insertions = data[date][author] || 0;
      table += `<td${rowColor}>${insertions}</td>`;
    });
    table += "</tr>";
  });

  table += "</table>";
  return table;
}

const commits = parseGitLog(gitLog);
let data = aggregateData(commits);
fillMissingDates(data);
data = mergeAuthors(data, authorMap);
const tableHtml = createTable(data);

fs.writeFileSync(
  "../public/gitLogData.js",
  `document.getElementById('gitLogOutput').innerHTML = \`${tableHtml}\`;`
);
