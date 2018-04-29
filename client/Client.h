#ifndef CLIENT_H
#define CLIENT_H

#include <string>
#include <cstdarg>
#include <assert.h>
#include <sys/stat.h>
#include <memory>
#include <mutex>
#include <openssl/bio.h>
#include <openssl/evp.h>
#include <openssl/sha.h>

struct CompilerArgs;
namespace Client {
std::mutex &mutex();
std::string findCompiler(int argc, char **argv);
void parsePath(const char *path, std::string *basename, std::string *dirname);
class Slot
{
public:
    Slot(int fd, std::string &&path);
   ~Slot();
private:
    Slot(const Slot &) = delete;
    Slot &operator=(const Slot &) = delete;

    const int mFD;
    const std::string mPath;
};

enum AcquireSlotMode {
    Try,
    Wait
};
std::unique_ptr<Slot> acquireSlot(AcquireSlotMode mode);
int runLocal(const std::string &compiler, int argc, char **argv, std::unique_ptr<Slot> &&slot);
unsigned long long mono();
bool setFlag(int fd, int flag);
bool recursiveMkdir(const std::string &path, mode_t mode = S_IRWXU);

struct Preprocessed
{
    std::string stdOut, stdErr;
    int exitStatus;
};
Preprocessed preprocess(const std::string &compiler, const std::shared_ptr<CompilerArgs> &args);

template <size_t StaticBufSize = 4096>
static std::string vformat(const char *format, va_list args)
{
    va_list copy;
    va_copy(copy, args);

    char buffer[StaticBufSize];
    const size_t size = ::vsnprintf(buffer, StaticBufSize, format, args);
    assert(size >= 0);
    std::string ret;
    if (size < StaticBufSize) {
        ret.assign(buffer, size);
    } else {
        ret.resize(size);
        ::vsnprintf(&ret[0], size+1, format, copy);
    }
    va_end(copy);
    return ret;
}

template <size_t StaticBufSize = 4096>
inline std::string format(const char *fmt, ...) __attribute__ ((__format__ (__printf__, 1, 2)));

template <size_t StaticBufSize>
inline std::string format(const char *fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    std::string ret = vformat<StaticBufSize>(fmt, args);
    va_end(args);
    return ret;
}

inline std::string sha1(const std::string &str)
{
    std::string res(SHA_DIGEST_LENGTH, ' ');
    SHA1(reinterpret_cast<const unsigned char *>(str.c_str()), str.size(), reinterpret_cast<unsigned char *>(&res[0]));
    return res;
}

inline std::string base64(const std::string &src)
{
    BIO *b64 = BIO_new(BIO_f_base64());
    BIO_set_flags(b64, BIO_FLAGS_BASE64_NO_NL);
    BIO *sink = BIO_new(BIO_s_mem());
    BIO_push(b64, sink);
    BIO_write(b64, &src[0], src.size());
    BIO_flush(b64);
    const char *encoded;
    const long len = BIO_get_mem_data(sink, &encoded);
    return std::string(encoded, len);
}

std::string environmentSignature(const std::string &compiler);
}

#endif /* CLIENT_H */
