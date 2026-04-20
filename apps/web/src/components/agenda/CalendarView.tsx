"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { useRouter } from "next/navigation";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color: string;
  textColor?: string;
  url?: string;
  extendedProps: {
    type: "task" | "activity";
    subType: string;
    relatedName?: string;
    overdue?: boolean;
  };
}

interface Props {
  events: CalendarEvent[];
}

function EventContent({ eventInfo }: { eventInfo: EventContentArg }) {
  const { event } = eventInfo;
  return (
    <div className="flex items-center gap-1 overflow-hidden px-1 py-0.5 text-xs leading-tight">
      <span className="truncate font-medium">{event.title}</span>
    </div>
  );
}

export function CalendarView({ events }: Props) {
  const router = useRouter();

  function handleEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    if (info.event.url) {
      router.push(info.event.url);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 [&_.fc]:font-sans [&_.fc-toolbar-title]:text-base [&_.fc-toolbar-title]:font-bold [&_.fc-button]:text-sm [&_.fc-button-primary]:!bg-primary [&_.fc-button-primary]:!border-primary [&_.fc-button-primary]:!text-primary-foreground [&_.fc-button-primary:hover]:!opacity-90 [&_.fc-button-primary.fc-button-active]:!bg-primary/80 [&_.fc-day-today]:!bg-primary/5 [&_.fc-event]:cursor-pointer [&_.fc-event]:rounded [&_.fc-daygrid-event-dot]:hidden [&_.fc-list-event:hover_td]:!bg-muted/40">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale="pt-br"
        firstDay={0}
        height="auto"
        events={events}
        eventClick={handleEventClick}
        eventContent={(info) => <EventContent eventInfo={info} />}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek",
        }}
        buttonText={{
          today: "Hoje",
          month: "Mês",
          week: "Semana",
          list: "Lista",
        }}
        noEventsText="Nenhum evento neste período"
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        dayMaxEvents={3}
        moreLinkText={(n) => `+${n} mais`}
      />
    </div>
  );
}
