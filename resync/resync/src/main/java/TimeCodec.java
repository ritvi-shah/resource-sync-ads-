import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;

public final class TimeCodec {
    private static final DateTimeFormatter STORAGE_FORMAT = new DateTimeFormatterBuilder()
            .appendInstant(9)
            .toFormatter();

    private TimeCodec() {
    }

    public static String format(Instant instant) {
        if (instant == null) {
            return null;
        }
        return STORAGE_FORMAT.format(instant);
    }
}
