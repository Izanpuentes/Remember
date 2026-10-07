FROM eclipse-temurin:21-jdk-jammy

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools

# Certificados raíz extra del host (ver docker/certs/README.md): para curl/apt y para Java (sdkmanager, Gradle)
COPY certs/ /usr/local/share/ca-certificates/host/
RUN update-ca-certificates \
 && for crt in /usr/local/share/ca-certificates/host/*.crt; do \
      [ -f "$crt" ] || continue; \
      keytool -importcert -noprompt -cacerts -storepass changeit -alias "host-$(basename "$crt" .crt)" -file "$crt"; \
    done

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip git ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSL -o /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
 && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
 && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm /tmp/tools.zip

RUN yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
