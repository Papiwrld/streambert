// ── Icons ───────────────────────────────────────────────────────────────────
// Single icon set: Lucide, one stroke width everywhere. The exported names
// are kept stable so call sites don't change. Icons without an explicit
// `size` are sized by their parent's CSS (e.g. `.btn svg`).
import {
  Search,
  History,
  Bookmark,
  Play,
  X,
  Film,
  Tv,
  House,
  Star,
  Settings,
  CircleHelp,
  Eye,
  Download,
  Trash2,
  Folder,
  CircleCheck,
  SquarePlay,
  HardDriveDownload,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  Globe,
  TriangleAlert,
  ExternalLink,
  ShieldCheck,
  Captions,
  PictureInPicture2,
  Users,
  Info,
  WifiOff,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Clapperboard,
  ThumbsUp,
  ThumbsDown,
  Bell,
  Palette,
  Library,
  Archive,
  Database,
  Gamepad2,
  RefreshCw,
  SlidersHorizontal,
  Accessibility,
  Bot,
  KeyRound,
  Drama,
  ChevronDown,
  ChevronUp,
  Plus,
  Upload,
  GripVertical,
  Clock,
  ArrowUp,
  ArrowDown,
  Pencil,
  Copy,
  EyeOff,
  FolderOpen,
  FileText,
  AlertCircle,
} from "lucide-react";

export const STROKE = 1.75;

const wrap = (Icon, defaults = {}) => {
  const Wrapped = ({ size, ...props }) => (
    <Icon
      size={size ?? defaults.size}
      strokeWidth={STROKE}
      absoluteStrokeWidth={false}
      aria-hidden="true"
      {...defaults.props}
      {...props}
    />
  );
  Wrapped.displayName = `${Icon.displayName || "Icon"}Wrapped`;
  return Wrapped;
};

export const StreambertLogo = ({ style }) => (
  <img
    src="./logo.svg"
    alt="Lumen"
    width="44"
    height="44"
    style={{ width: "100%", height: "100%", display: "block", ...style }}
  />
);

export const SearchIcon = wrap(Search);
export const HistoryIcon = wrap(History);
export const BookmarkIcon = wrap(Bookmark);
export const BookmarkFillIcon = wrap(Bookmark, {
  props: { fill: "currentColor" },
});
export const PlayIcon = wrap(Play, { props: { fill: "currentColor" } });
export const CloseIcon = wrap(X);
export const FilmIcon = wrap(Film);
export const TVIcon = wrap(Tv);
export const HomeIcon = wrap(House);
export const StarIcon = ({ size = 16 }) => (
  <Star
    size={size}
    strokeWidth={0}
    fill="currentColor"
    aria-hidden="true"
  />
);
export const SettingsIcon = wrap(Settings);
export const HelpIcon = wrap(CircleHelp);
export const EyeIcon = wrap(Eye);
export const DownloadIcon = wrap(Download);
export const TrashIcon = wrap(Trash2);
export const FolderIcon = wrap(Folder);
export const TrailerIcon = wrap(SquarePlay);
export const DownloadsQueueIcon = wrap(HardDriveDownload);
export const QuitIcon = wrap(LogOut);
export const BackIcon = wrap(ChevronLeft);
export const ChevronLeftIcon = wrap(ChevronLeft, { size: 24 });
export const ChevronRightIcon = wrap(ChevronRight, { size: 24 });
export const RatingShieldIcon = wrap(Shield, { size: 10 });
export const RatingLockIcon = wrap(Lock, { size: 10 });
export const SourceIcon = wrap(Globe);
export const ExternalLinkIcon = wrap(ExternalLink, { size: 13 });
export const ShieldBlockIcon = wrap(ShieldCheck, { size: 16 });
export const SubtitlesIcon = wrap(Captions, { size: 16 });
export const PopOutIcon = wrap(PictureInPicture2, { size: 16 });
export const InfoIcon = wrap(Info);
export const WifiOffIcon = wrap(WifiOff);
export const CheckIcon = wrap(Check);
export const ResetIcon = wrap(RotateCcw);
export const VolumeIcon = wrap(Volume2);
export const VolumeOffIcon = wrap(VolumeX);
export const MoviesIcon = wrap(Clapperboard);
export const CastIcon = wrap(Users, { size: 20 });
export const BellIcon = wrap(Bell);
export const PaletteIcon = wrap(Palette);
export const LibraryIcon = wrap(Library);
export const ArchiveIcon = wrap(Archive);
export const DatabaseIcon = wrap(Database);
export const GamepadIcon = wrap(Gamepad2);
export const RefreshIcon = wrap(RefreshCw);
export const SlidersIcon = wrap(SlidersHorizontal);
export const AccessibilityIcon = wrap(Accessibility);
export const BotIcon = wrap(Bot);
export const KeyIcon = wrap(KeyRound);
export const CastCrewIcon = wrap(Drama);
export const GlobeIcon = wrap(Globe);
export const ChevronDownIcon = wrap(ChevronDown, { size: 14 });
export const ChevronUpIcon = wrap(ChevronUp, { size: 14 });
export const PlusIcon = wrap(Plus, { size: 14 });
export const UploadIcon = wrap(Upload, { size: 15 });
export const GripVerticalIcon = wrap(GripVertical, { size: 15 });
export const ClockIcon = wrap(Clock, { size: 20 });
export const ArrowUpIcon = wrap(ArrowUp, { size: 13 });
export const ArrowDownIcon = wrap(ArrowDown, { size: 13 });
export const PencilIcon = wrap(Pencil, { size: 11 });
export const CopyIcon = wrap(Copy, { size: 14 });
export const EyeOffIcon = wrap(EyeOff, { size: 14 });
export const EyeOpenIcon = wrap(Eye, { size: 14 });
export const FolderOpenIcon = wrap(FolderOpen, { size: 15 });
export const FileTextIcon = wrap(FileText, { size: 13 });
export const AlertCircleIcon = wrap(AlertCircle, { size: 15 });


export const WarningIcon = ({ size = 24, color = "var(--red)" }) => (
  <TriangleAlert
    size={size}
    color={color}
    strokeWidth={STROKE}
    aria-hidden="true"
  />
);

// Watched state: plain check in a circle, no glow.
export const WatchedIcon = ({ size = 22 }) => (
  <CircleCheck
    size={size}
    strokeWidth={STROKE}
    color="var(--success)"
    aria-hidden="true"
  />
);
export const ThumbsUpIcon = wrap(ThumbsUp);
export const ThumbsDownIcon = wrap(ThumbsDown);
