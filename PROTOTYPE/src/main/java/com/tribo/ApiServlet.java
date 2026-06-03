package com.tribo;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;

@WebServlet(name = "ApiServlet", urlPatterns = {"/api/*"})
public class ApiServlet extends HttpServlet {

    private static final Map<String, String> ROUTES = Map.of(
        "/feed",             MockData.FEED,
        "/clans",            MockData.CLANS,
        "/clan-ranking",     MockData.CLAN_RANKING,
        "/profile",          MockData.PROFILE,
        "/volunteer-events", MockData.VOLUNTEER_EVENTS,
        "/run-summary",      MockData.RUN_SUMMARY
    );

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo();
        String body = path == null ? null : ROUTES.get(path);

        if (body == null) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.setContentType("application/json; charset=utf-8");
            resp.getWriter().write("{\"error\":\"unknown endpoint\"}");
            return;
        }

        resp.setStatus(HttpServletResponse.SC_OK);
        resp.setContentType("application/json; charset=utf-8");
        resp.setHeader("Cache-Control", "no-store");
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.getWriter().write(body);
    }
}
