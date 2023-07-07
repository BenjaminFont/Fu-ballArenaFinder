import axios from "axios";
import * as cheerio from "cheerio";
import moment from "moment";
import { ArenaEntry, TimeSlot } from "../common.js";


async function retrieve(endpoint_url, requested_date) {
  const axiosResponse = await axios.request({
    method: "GET",
    params: {
      action: "showReservations",
      type_id: "3", // ???
      date: requested_date.format("YYYY-MM-DD"),
    },
    url: endpoint_url,
  });
  return axiosResponse;
}


async function parse(data, endpoint_url, requested_date) {
  const $ = cheerio.load(data);

  const tables = $('table[class=day-reservations-table-area]');
  const courts = tables.toArray().map((table) => {
    const location = $(table).find("tr").find("th").first().text().trim();
    const availabilities = $(table)
      .find("tr")
      .toArray()
      .map((row) => {
        const time_slot_str = $(row).find("td").text().trim();
        if (time_slot_str === "") {
          return;
        }
        const is_available = ($(row).find("td").first().attr("class") === "available");
        const time_slots = time_slot_str
          .split(" - ", 2)
          .map((value) => moment(`${requested_date.format("YYYY-MM-DD")} ${value}`, "YYYY-MM-DD hh:mm"));
        return new TimeSlot(time_slots[0], time_slots[1], is_available);
      })
      .filter((availability) => availability !== undefined)
      .sort((a, b) => a.time_slot_start - b.time_slot_start);

    return new ArenaEntry(endpoint_url, location, requested_date, availabilities, moment());
  });

  return courts;
}


export async function scrape(requested_date) {
  const courts_metadata = [
    { name: "McArena Schorndorf", url: "https://mcarena-schorndorf.de/reservations.php" },
    { name: "McArena Esslingen", url: "https://mcarena-esslingen.de/reservations.php" },
    { name: "McArena Aspach", url: "https://ssl.forumedia.eu/mcarena-aspach.de/reservations.php" },
    { name: "McArena Auenstein", url: "https://www.mcarena-auenstein.de/reservations.php" },
  ];

  let results = await Promise.all(courts_metadata.map(async court_meta => {
    const response = await retrieve(court_meta.url, requested_date);
    let parsed = await parse(response.data, court_meta.url, requested_date);
    parsed.map(entry => { entry.court = `${court_meta.name}/${entry.court}` })
    return parsed;
  }));
  return results.flat(1);
}
