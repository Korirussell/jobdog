package dev.jobdog.backend.admin;

import dev.jobdog.backend.auth.CurrentUser;
import dev.jobdog.backend.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * The site owner's view of who is using the site. Admin role only; everyone else
 * gets a 403, and the route isn't linked from anywhere they can see.
 */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService adminService;
    private final CurrentUser currentUser;

    public AdminController(AdminService adminService, CurrentUser currentUser) {
        this.adminService = adminService;
        this.currentUser = currentUser;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> overview() {
        if (currentUser.require().role() != UserRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin only");
        }
        return ResponseEntity.ok(adminService.overview());
    }
}
