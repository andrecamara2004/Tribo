package com.tribo;

public final class MockData {

    private MockData() {}

    public static final String PROFILE = """
        {
          "id": "u_ana",
          "name": "Ana Costa",
          "handle": "@anacosta",
          "initials": "AC",
          "color": "#00B86B",
          "role": "Activity Manager",
          "clan": { "id": "c_forest", "name": "Forest Runners", "tag": "FOR" },
          "stats": {
            "monthKm": 142.6,
            "monthRuns": 18,
            "avgPace": "4:48",
            "volunteerEvents": 4,
            "volunteerPoints": 420,
            "staffEligible": true,
            "streak": 9
          },
          "achievements": [
            { "icon": "🏅", "title": "Sub-5 pace",      "sub": "10 runs under 5:00/km" },
            { "icon": "🌳", "title": "Eco Runner",      "sub": "4 volunteer events"    },
            { "icon": "🔥", "title": "9-day streak",    "sub": "Keep it going"         },
            { "icon": "🛡️", "title": "Trusted staff",   "sub": "Verified 2 events"     }
          ],
          "weeklyKm": [6.2, 0, 8.4, 5.1, 12.0, 4.5, 10.3]
        }
        """;

    public static final String FEED = """
        [
          {
            "id": "a1",
            "type": "run",
            "user": { "name": "Miguel Sousa", "initials": "MS", "color": "#1B8A5A", "clan": "Forest Runners" },
            "title": "Morning shakeout along the Tagus",
            "when": "Today, 07:42",
            "location": "Belém, Lisboa",
            "distanceKm": 8.4,
            "duration": "38:21",
            "pace": "4:34",
            "elevationM": 22,
            "kudos": 14,
            "comments": 3,
            "route": "river"
          },
          {
            "id": "a2",
            "type": "volunteer",
            "user": { "name": "Beatriz Silva", "initials": "BS", "color": "#FFB020", "clan": "Sunday Striders" },
            "title": "Trail cleanup + 5k",
            "when": "Today, 06:15",
            "location": "Serra de Sintra",
            "distanceKm": 5.2,
            "duration": "32:08",
            "pace": "6:11",
            "role": "staff",
            "pointsEarned": 110,
            "kudos": 41,
            "comments": 9,
            "route": "trail"
          },
          {
            "id": "a3",
            "type": "run",
            "user": { "name": "João Pereira", "initials": "JP", "color": "#3A7BD5", "clan": "Trash Hunters" },
            "title": "Tempo session — felt good",
            "when": "Yesterday, 19:30",
            "location": "Parque das Nações",
            "distanceKm": 12.1,
            "duration": "52:14",
            "pace": "4:19",
            "elevationM": 18,
            "kudos": 22,
            "comments": 4,
            "route": "park"
          },
          {
            "id": "a4",
            "type": "volunteer",
            "user": { "name": "Ana Costa", "initials": "AC", "color": "#00B86B", "clan": "Forest Runners" },
            "title": "Plogging at Monsanto",
            "when": "Yesterday, 08:02",
            "location": "Monsanto, Lisboa",
            "distanceKm": 6.8,
            "duration": "44:12",
            "pace": "6:30",
            "role": "participant",
            "pointsEarned": 100,
            "kudos": 36,
            "comments": 7,
            "route": "trail"
          },
          {
            "id": "a5",
            "type": "run",
            "user": { "name": "Inês Marques", "initials": "IM", "color": "#D5398B", "clan": "Tribo do Tejo" },
            "title": "Hilly long run",
            "when": "Yesterday, 09:14",
            "location": "Costa da Caparica",
            "distanceKm": 18.2,
            "duration": "1:31:40",
            "pace": "5:02",
            "elevationM": 184,
            "kudos": 58,
            "comments": 11,
            "route": "coast"
          },
          {
            "id": "a6",
            "type": "run",
            "user": { "name": "Rui Tavares", "initials": "RT", "color": "#7B5BD9", "clan": "Forest Runners" },
            "title": "Recovery jog",
            "when": "2 days ago",
            "location": "Avenida da Liberdade",
            "distanceKm": 4.0,
            "duration": "22:30",
            "pace": "5:37",
            "elevationM": 8,
            "kudos": 7,
            "comments": 1,
            "route": "city"
          }
        ]
        """;

    public static final String CLAN_RANKING = """
        {
          "metric": "avgPace",
          "updatedAt": "May 10, 17:02",
          "clans": [
            {
              "rank": 1,
              "id": "c_forest",
              "name": "Forest Runners",
              "tag": "FOR",
              "color": "#00B86B",
              "members": 20,
              "totalKm": 3247.4,
              "monthlyKm": 1420.5,
              "avgPace": "4:42",
              "weeklyKm": 412.0,
              "consistencyPct": 95,
              "volunteerPoints": 8620,
              "volunteerEvents": 86,
              "trend": "up"
            },
            {
              "rank": 2,
              "id": "c_trash",
              "name": "Trash Hunters",
              "tag": "THU",
              "color": "#3A7BD5",
              "members": 20,
              "totalKm": 2890.7,
              "monthlyKm": 1180.3,
              "avgPace": "5:01",
              "weeklyKm": 387.0,
              "consistencyPct": 82,
              "volunteerPoints": 12480,
              "volunteerEvents": 124,
              "trend": "up"
            },
            {
              "rank": 3,
              "id": "c_sunday",
              "name": "Sunday Striders",
              "tag": "SUN",
              "color": "#FFB020",
              "members": 20,
              "totalKm": 2654.1,
              "monthlyKm": 1050.8,
              "avgPace": "4:55",
              "weeklyKm": 356.0,
              "consistencyPct": 88,
              "volunteerPoints": 5840,
              "volunteerEvents": 58,
              "trend": "flat"
            },
            {
              "rank": 4,
              "id": "c_tejo",
              "name": "Tribo do Tejo",
              "tag": "TJO",
              "color": "#D5398B",
              "members": 19,
              "totalKm": 2103.9,
              "monthlyKm": 820.4,
              "avgPace": "5:14",
              "weeklyKm": 298.0,
              "consistencyPct": 71,
              "volunteerPoints": 4140,
              "volunteerEvents": 41,
              "trend": "down"
            },
            {
              "rank": 5,
              "id": "c_cascais",
              "name": "Cascais Coastal",
              "tag": "CAS",
              "color": "#7B5BD9",
              "members": 16,
              "totalKm": 1876.3,
              "monthlyKm": 680.2,
              "avgPace": "5:21",
              "weeklyKm": 198.7,
              "consistencyPct": 63,
              "volunteerPoints": 2450,
              "volunteerEvents": 24,
              "trend": "up"
            }
          ]
        }
        """;

    public static final String CLANS = """
        [
          { "id": "c_forest",  "name": "Forest Runners",   "members": 20, "color": "#00B86B" },
          { "id": "c_trash",   "name": "Trash Hunters",    "members": 20, "color": "#3A7BD5" },
          { "id": "c_sunday",  "name": "Sunday Striders",  "members": 20, "color": "#FFB020" },
          { "id": "c_tejo",    "name": "Tribo do Tejo",    "members": 19, "color": "#D5398B" },
          { "id": "c_cascais", "name": "Cascais Coastal",  "members": 16, "color": "#7B5BD9" }
        ]
        """;

    public static final String VOLUNTEER_EVENTS = """
        [
          {
            "id": "v1",
            "title": "Tagus Riverside Cleanup",
            "date": "Sat 16 May · 08:30",
            "location": "Cais do Sodré → Belém",
            "distanceKm": 7.0,
            "host": "Forest Runners",
            "verifiedBy": "peer",
            "tags": ["river", "easy"],
            "color": "#00B86B",
            "pointsParticipant": 100,
            "pointsStaff": 110,
            "staffSpots": 5,
            "participantSpots": 20,
            "staffJoined": 4,
            "staffPreview": [
              { "name": "Beatriz Silva",  "color": "#FFB020" },
              { "name": "Rui Tavares",    "color": "#7B5BD9" },
              { "name": "João Pereira",   "color": "#3A7BD5" },
              { "name": "Inês Marques",   "color": "#D5398B" }
            ],
            "participantsJoined": 14,
            "participantsPreview": [
              { "name": "Miguel Sousa",   "color": "#1B8A5A" },
              { "name": "Ana Costa",      "color": "#00B86B" },
              { "name": "Pedro Almeida",  "color": "#3A7BD5" },
              { "name": "Carolina Matos", "color": "#FFB020" }
            ],
            "userRole": "participant"
          },
          {
            "id": "v2",
            "title": "Monsanto Trail Sweep",
            "date": "Sun 17 May · 09:00",
            "location": "Parque Florestal de Monsanto",
            "distanceKm": 9.5,
            "host": "Tribo Lisboa",
            "verifiedBy": "peer",
            "tags": ["trail", "moderate"],
            "color": "#1B8A5A",
            "pointsParticipant": 100,
            "pointsStaff": 110,
            "staffSpots": 5,
            "participantSpots": 20,
            "staffJoined": 5,
            "staffPreview": [
              { "name": "Ana Costa",      "color": "#00B86B" },
              { "name": "Beatriz Silva",  "color": "#FFB020" },
              { "name": "Miguel Sousa",   "color": "#1B8A5A" },
              { "name": "João Pereira",   "color": "#3A7BD5" }
            ],
            "participantsJoined": 8,
            "participantsPreview": [
              { "name": "Inês Marques",   "color": "#D5398B" },
              { "name": "Rui Tavares",    "color": "#7B5BD9" },
              { "name": "Pedro Almeida",  "color": "#3A7BD5" },
              { "name": "Carolina Matos", "color": "#FFB020" }
            ],
            "userRole": "staff"
          },
          {
            "id": "v3",
            "title": "Costa da Caparica Beach Run",
            "date": "Sat 23 May · 07:30",
            "location": "Praia da Costa, Almada",
            "distanceKm": 5.0,
            "host": "Câmara Municipal de Almada",
            "verifiedBy": "partner",
            "tags": ["beach", "easy"],
            "color": "#3A7BD5",
            "pointsParticipant": 100,
            "pointsStaff": 110,
            "staffSpots": 5,
            "participantSpots": 20,
            "staffJoined": 2,
            "staffPreview": [
              { "name": "Inês Marques",   "color": "#D5398B" },
              { "name": "Pedro Almeida",  "color": "#3A7BD5" }
            ],
            "participantsJoined": 18,
            "participantsPreview": [
              { "name": "Miguel Sousa",   "color": "#1B8A5A" },
              { "name": "Beatriz Silva",  "color": "#FFB020" },
              { "name": "Rui Tavares",    "color": "#7B5BD9" },
              { "name": "Carolina Matos", "color": "#FFB020" }
            ],
            "userRole": null
          },
          {
            "id": "v4",
            "title": "Sintra Hills Plogging",
            "date": "Sun 24 May · 08:00",
            "location": "Vila de Sintra",
            "distanceKm": 11.0,
            "host": "Quercus",
            "verifiedBy": "partner",
            "tags": ["trail", "hard", "elevation"],
            "color": "#FFB020",
            "pointsParticipant": 100,
            "pointsStaff": 110,
            "staffSpots": 5,
            "participantSpots": 20,
            "staffJoined": 1,
            "staffPreview": [
              { "name": "Beatriz Silva",  "color": "#FFB020" }
            ],
            "participantsJoined": 5,
            "participantsPreview": [
              { "name": "João Pereira",   "color": "#3A7BD5" },
              { "name": "Inês Marques",   "color": "#D5398B" },
              { "name": "Rui Tavares",    "color": "#7B5BD9" }
            ],
            "userRole": null
          }
        ]
        """;

    public static final String RUN_SUMMARY = """
        {
          "live": {
            "distanceKm": 5.42,
            "duration": "26:18",
            "pace": "4:51",
            "currentBpm": 152,
            "splits": [
              { "km": 1, "pace": "4:58", "bpm": 144 },
              { "km": 2, "pace": "4:52", "bpm": 149 },
              { "km": 3, "pace": "4:47", "bpm": 153 },
              { "km": 4, "pace": "4:49", "bpm": 155 },
              { "km": 5, "pace": "4:50", "bpm": 156 }
            ]
          }
        }
        """;
}
