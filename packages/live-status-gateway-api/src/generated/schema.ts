/* eslint-disable */
/**
 * This file was automatically generated using and @asyncapi/parser @asyncapi/modelina.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source AsyncAPI schema files,
 * and run "yarn generate-schema-types" to regenerate this file.
 */


type Slash = PongEvent | HeartbeatEvent | SubscriptionStatusError | SubscriptionStatusSuccess | StudioEvent | ActivePlaylistEvent | ActivePiecesEvent | SegmentsEvent | AdLibsEvent;

interface PongEvent {
  'event': 'pong';
  /**
   * Client originated ID reflected in response message.
   */
  'reqid': number;
}

interface HeartbeatEvent {
  'event': 'heartbeat';
}

interface SubscriptionStatusError {
  'errorMessage': string;
  'event': 'subscriptionStatus';
  /**
   * Client originated ID reflected in response message.
   */
  'reqid': number;
  'subscription': SubscriptionDetails;
}

interface SubscriptionDetails {
  /**
   * The name of the topic related to this status.
   */
  'name': SubscriptionName;
  /**
   * The current status of the subscription
   */
  'status': SubscriptionStatus;
}

/**
 * The name of the topic related to this status.
 */
enum SubscriptionName {
  STUDIO = "studio",
  ACTIVE_PLAYLIST = "activePlaylist",
  ACTIVE_PIECES = "activePieces",
  SEGMENTS = "segments",
  AD_LIBS = "adLibs",
}

/**
 * The current status of the subscription
 */
enum SubscriptionStatus {
  SUBSCRIBED = "subscribed",
  UNSUBSCRIBED = "unsubscribed",
}

interface SubscriptionStatusSuccess {
  'event': 'subscriptionStatus';
  /**
   * Client originated ID reflected in response message.
   */
  'reqid': number;
  'subscription': SubscriptionDetails;
}

interface StudioEvent {
  'event': 'studio';
  /**
   * Unique id of the studio
   */
  'id': string | null;
  /**
   * User-presentable name for the studio installation
   */
  'name': string;
  /**
   * The playlists that are currently loaded in the studio
   */
  'playlists': PlaylistStatus[];
}

interface PlaylistStatus {
  /**
   * Unique id of the playlist
   */
  'id': string;
  /**
   * The user defined playlist name
   */
  'name': string;
  /**
   * Whether this playlist is currently active or in rehearsal
   */
  'activationStatus': PlaylistActivationStatus;
}

/**
 * Whether this playlist is currently active or in rehearsal
 */
enum PlaylistActivationStatus {
  DEACTIVATED = "deactivated",
  REHEARSAL = "rehearsal",
  ACTIVATED = "activated",
}

interface ActivePlaylistEvent {
  'event': 'activePlaylist';
  /**
   * Unique id of the active playlist
   */
  'id': string | null;
  /**
   * User-presentable name for the active playlist
   */
  'name': string;
  /**
   * The set of rundownIds in the active playlist
   */
  'rundownIds': string[];
  'currentPart': CurrentPartStatus | null;
  'currentSegment': CurrentSegment | null;
  'nextPart': PartStatus | null;
  /**
   * Optional arbitrary data
   */
  'publicData'?: any;
  /**
   * Information about the current quickLoop, if any
   */
  'quickLoop'?: ActivePlaylistQuickLoop;
  /**
   * Timing information about the active playlist
   */
  'timing': ActivePlaylistTiming;
}

interface CurrentPartStatus {
  /**
   * Unique id of the part
   */
  'id': string;
  /**
   * User name of the part
   */
  'name': string;
  /**
   * Unique id of the segment this part belongs to
   */
  'segmentId': string;
  /**
   * If this part will progress to the next automatically
   */
  'autoNext'?: boolean;
  /**
   * All pieces in this part
   */
  'pieces': PieceStatus[];
  /**
   * Optional arbitrary data
   */
  'publicData'?: any;
  /**
   * Timing information about the current part
   */
  'timing': CurrentPartTiming;
  'additionalProperties'?: Record<string, any>;
}

interface PieceStatus {
  /**
   * Unique id of the Piece
   */
  'id': string;
  /**
   * User-facing name of the Piece
   */
  'name': string;
  /**
   * The source layer name for this Piece
   */
  'sourceLayer': string;
  /**
   * The output layer name for this Piece
   */
  'outputLayer': string;
  /**
   * Tags attached to this Piece
   */
  'tags'?: string[];
  /**
   * Optional arbitrary data
   */
  'publicData'?: any;
}

/**
 * Timing information about the current part
 */
interface CurrentPartTiming {
  /**
   * Unix timestamp of when the part started (milliseconds)
   */
  'startTime': number;
  /**
   * Expected duration of the part (milliseconds)
   */
  'expectedDurationMs': number;
  /**
   * Unix timestamp of when the part is projected to end (milliseconds). A sum of `startTime` and `expectedDurationMs`.
   */
  'projectedEndTime': number;
  'additionalProperties'?: Record<string, any>;
}

interface CurrentSegment {
  /**
   * Unique id of the segment
   */
  'id': string;
  /**
   * Timing information about the current segment
   */
  'timing': CurrentSegmentTiming;
}

/**
 * Timing information about the current segment
 */
interface CurrentSegmentTiming {
  /**
   * Expected duration of the segment
   */
  'expectedDurationMs': number;
  /**
   * Budget duration of the segment
   */
  'budgetDurationMs'?: number;
  /**
   * Unix timestamp of when the segment is projected to end (milliseconds). The time this segment started, offset by its budget duration, if the segment has a defined budget duration. Otherwise, the time the current part started, offset by the difference between expected durations of all parts in this segment and the as-played durations of the parts that already stopped.
   */
  'projectedEndTime': number;
  /**
   * Countdown type within the segment. Default: `part_expected_duration`
   */
  'countdownType'?: SegmentCountdownType;
  'additionalProperties'?: Record<string, any>;
}

/**
 * Countdown type within the segment. Default: `part_expected_duration`
 */
enum SegmentCountdownType {
  PART_EXPECTED_DURATION = "part_expected_duration",
  SEGMENT_BUDGET_DURATION = "segment_budget_duration",
}

interface PartStatus {
  /**
   * Unique id of the part
   */
  'id': string;
  /**
   * User name of the part
   */
  'name': string;
  /**
   * Unique id of the segment this part belongs to
   */
  'segmentId': string;
  /**
   * If this part will progress to the next automatically
   */
  'autoNext'?: boolean;
  /**
   * All pieces in this part
   */
  'pieces': PieceStatus[];
  /**
   * Optional arbitrary data
   */
  'publicData'?: any;
  'additionalProperties'?: Record<string, any>;
}

/**
 * Information about the current quickLoop, if any
 */
interface ActivePlaylistQuickLoop {
  /**
   * Whether the user is allowed to make alterations to the Start/End markers
   */
  'locked': boolean;
  /**
   * Whether the loop has two valid markers and is currently running
   */
  'running': boolean;
  'start'?: QuickLoopMarker;
  'end'?: QuickLoopMarker;
  'additionalProperties'?: Record<string, any>;
}

interface QuickLoopMarker {
  /**
   * The type of entity the marker is locked to
   */
  'markerType': QuickLoopMarkerType;
  /**
   * The rundown that this marker references. This will be set for rundown, segment and part markers
   */
  'rundownId'?: string;
  /**
   * The segment that this marker references. This will be set for segment and part markers
   */
  'segmentId'?: string;
  /**
   * The part that this marker references. This will be set for only part markers
   */
  'partId'?: string;
  'additionalProperties'?: Record<string, any>;
}

/**
 * The type of entity the marker is locked to
 */
enum QuickLoopMarkerType {
  PLAYLIST = "playlist",
  RUNDOWN = "rundown",
  SEGMENT = "segment",
  PART = "part",
}

/**
 * Timing information about the active playlist
 */
interface ActivePlaylistTiming {
  /**
   * Timing mode for the playlist.
   */
  'timingMode': ActivePlaylistTimingMode;
  /**
   * Unix timestamp of when the playlist started (milliseconds)
   */
  'startedPlayback'?: number;
  /**
   * Unix timestamp of when the playlist is expected to start (milliseconds). Required when the timingMode is set to forward-time.
   */
  'expectedStart'?: number;
  /**
   * Duration of the playlist in ms
   */
  'expectedDurationMs'?: number;
  /**
   * Unix timestamp of when the playlist is expected to end (milliseconds) Required when the timingMode is set to back-time.
   */
  'expectedEnd'?: number;
}

/**
 * Timing mode for the playlist.
 */
enum ActivePlaylistTimingMode {
  NONE = "none",
  FORWARD_MINUS_TIME = "forward-time",
  BACK_MINUS_TIME = "back-time",
}

interface ActivePiecesEvent {
  'event': 'activePieces';
  /**
   * Unique id of the rundown playlist, or null if no playlist is active
   */
  'rundownPlaylistId': string | null;
  /**
   * Pieces that are currently active (on air)
   */
  'activePieces': PieceStatus[];
}

interface SegmentsEvent {
  'event': 'segments';
  /**
   * Unique id of the rundown playlist, or null if no playlist is active
   */
  'rundownPlaylistId': string | null;
  /**
   * The segments that are in the currently active rundown playlist, in order
   */
  'segments': Segment[];
}

interface Segment {
  /**
   * Unique id of the segment
   */
  'id': string;
  /**
   * User-facing identifier that can be used to identify the contents of a segment in the Rundown source system
   */
  'identifier'?: string;
  /**
   * Unique id of the rundown this segment belongs to
   */
  'rundownId': string;
  /**
   * Name of the segment
   */
  'name': string;
  'timing': SegmentTiming;
  /**
   * Optional arbitrary data
   */
  'publicData'?: any;
}

interface SegmentTiming {
  /**
   * Expected duration of the segment (milliseconds)
   */
  'expectedDurationMs': number;
  /**
   * Budget duration of the segment (milliseconds)
   */
  'budgetDurationMs'?: number;
  /**
   * Countdown type within the segment. Default: `part_expected_duration`
   */
  'countdownType'?: SegmentCountdownType;
  'additionalProperties'?: Record<string, any>;
}

interface AdLibsEvent {
  'event': 'adLibs';
  /**
   * Unique id of the rundown playlist, or null if no playlist is active
   */
  'rundownPlaylistId': string | null;
  /**
   * The available AdLibs for this playlist
   */
  'adLibs': AdLibStatus[];
  /**
   * The available Global AdLibs for this playlist
   */
  'globalAdLibs': GlobalAdLibStatus[];
}

interface AdLibStatus {
  /**
   * Unique id of the AdLib
   */
  'id': string;
  /**
   * The user defined AdLib name
   */
  'name': string;
  /**
   * The source layer name for this AdLib
   */
  'sourceLayer': string;
  /**
   * The output layer name for this AdLib
   */
  'outputLayer'?: string;
  /**
   * The available action type names that can be used to modify the execution of the AdLib
   */
  'actionType': AdLibActionType[];
  /**
   * Tags attached to this AdLib
   */
  'tags'?: string[];
  /**
   * Optional arbitrary data
   */
  'publicData'?: any;
  /**
   * Unique id of the segment this adLib belongs to
   */
  'segmentId': string;
  /**
   * Unique id of the part this adLib belongs to
   */
  'partId': string;
  'additionalProperties'?: Record<string, any>;
}

interface AdLibActionType {
  /**
   * The string to be passed to the ExecuteAdlib function
   */
  'name': string;
  /**
   * The label for the AdLib type
   */
  'label': string;
}

interface GlobalAdLibStatus {
  /**
   * Unique id of the AdLib
   */
  'id': string;
  /**
   * The user defined AdLib name
   */
  'name': string;
  /**
   * The source layer name for this AdLib
   */
  'sourceLayer': string;
  /**
   * The output layer name for this AdLib
   */
  'outputLayer'?: string;
  /**
   * The available action type names that can be used to modify the execution of the AdLib
   */
  'actionType': AdLibActionType[];
  /**
   * Tags attached to this AdLib
   */
  'tags'?: string[];
  /**
   * Optional arbitrary data
   */
  'publicData'?: any;
  'additionalProperties'?: Record<string, any>;
}

export {Slash, PongEvent, HeartbeatEvent, SubscriptionStatusError, SubscriptionDetails, SubscriptionName, SubscriptionStatus, SubscriptionStatusSuccess, StudioEvent, PlaylistStatus, PlaylistActivationStatus, ActivePlaylistEvent, CurrentPartStatus, PieceStatus, CurrentPartTiming, CurrentSegment, CurrentSegmentTiming, SegmentCountdownType, PartStatus, ActivePlaylistQuickLoop, QuickLoopMarker, QuickLoopMarkerType, ActivePlaylistTiming, ActivePlaylistTimingMode, ActivePiecesEvent, SegmentsEvent, Segment, SegmentTiming, AdLibsEvent, AdLibStatus, AdLibActionType, GlobalAdLibStatus};