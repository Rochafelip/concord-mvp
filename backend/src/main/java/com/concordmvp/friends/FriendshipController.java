package com.concordmvp.friends;

import com.concordmvp.common.CurrentUser;
import com.concordmvp.friends.dto.FriendResponse;
import com.concordmvp.friends.dto.PendingFriendRequestsResponse;
import com.concordmvp.friends.dto.SendFriendRequestRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/friends")
public class FriendshipController {

    private final FriendshipService friendshipService;

    public FriendshipController(FriendshipService friendshipService) {
        this.friendshipService = friendshipService;
    }

    @GetMapping
    public List<FriendResponse> listFriends() {
        return friendshipService.listFriends(CurrentUser.id());
    }

    @GetMapping("/requests")
    public PendingFriendRequestsResponse listPending() {
        return friendshipService.listPending(CurrentUser.id());
    }

    @PostMapping("/requests")
    public ResponseEntity<Void> sendRequest(@Valid @RequestBody SendFriendRequestRequest request) {
        friendshipService.sendRequest(CurrentUser.id(), request.addresseeId());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/requests/{friendshipId}/accept")
    public ResponseEntity<Void> acceptRequest(@PathVariable UUID friendshipId) {
        friendshipService.acceptRequest(friendshipId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/requests/{friendshipId}")
    public ResponseEntity<Void> cancelOrDeclineRequest(@PathVariable UUID friendshipId) {
        friendshipService.cancelOrDecline(friendshipId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{friendshipId}")
    public ResponseEntity<Void> removeFriend(@PathVariable UUID friendshipId) {
        friendshipService.removeFriend(friendshipId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }
}
