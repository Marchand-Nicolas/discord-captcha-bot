const { MessageActionRow, MessageButton, MessageEmbed } = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const { maxInteractionDuration } = require("../globalConfig.json");
const { getRandomInt } = require("../utils/int");

module.exports = {
  sendImagesCaptcha: async function sendImagesCaptcha(
    cache,
    interaction,
    totalImages,
    captchaDatas,
    roleId,
    steps = 1,
    error = ""
  ) {
    if (!cache.guilds[interaction.guildId])
      cache.guilds[interaction.guildId] = {
        members: {},
      };
    if (!cache.guilds[interaction.guildId].members[interaction.member.user.id])
      cache.guilds[interaction.guildId].members[interaction.member.user.id] = {
        interactions: [new Date().getTime()],
      };
    else {
      if (
        cache.guilds[interaction.guildId].members[interaction.member.user.id]
          .interactions.length >= 10
      ) {
        interaction.reply({
          content:
            "❌ You have reached the maximum number of interactions. Please try again later.",
          ephemeral: true,
        });
        return;
      }
      cache.guilds[interaction.guildId].members[
        interaction.member.user.id
      ].interactions.push(new Date().getTime());
    }
    const imageNumber = 9;
    const date = (
      new Date(new Date().getTime() + maxInteractionDuration).getTime() / 1000
    ).toFixed(0);
    const embed = new MessageEmbed()
      .setColor(error ? "RED" : "#74d579")
      .setTitle("Captcha")
      .setThumbnail("https://i.imgur.com/m2jRNLg.png");
    embed.setDescription(`${error ? `**${error}**\n` : ""}
            <a:Loading:991374833541718156> **Step ${steps}/2** : Which of the ${imageNumber} images above is upright ?\n
            Click on the button corresponding to the number of the correct image.\n
            Expires <t:${date}:R>
        `);
    const row = new MessageActionRow();
    const row2 = new MessageActionRow();
    for (let i = 0; i < imageNumber; i++) {
      (i <= 4 ? row : row2).addComponents(
        new MessageButton()
          .setCustomId(`role_${roleId}_CaptchaImages_${i}`)
          .setLabel(`${i + 1}`)
          .setStyle("SECONDARY")
      );
    }
    const canvas = createCanvas(210, 210);
    const ctx = canvas.getContext("2d");
    let x = 0;
    let y = 0;
    const selectedImage = Math.floor(Math.random() * imageNumber);
    captchaDatas[interaction.member] = {
      date: Date.now(),
      selectedImage: selectedImage,
    };
    const image = totalImages[Math.floor(Math.random() * totalImages.length)];
    await loadImage(`images/${image}`).then((image) => {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    });
    ctx.rotate(0.02);
    for (let index = 0; index < imageNumber; index++) {
      ctx.save();
      ctx.translate(x + 35, y + 35);
      if (selectedImage != index) {
        ctx.rotate(Math.PI * 0.5 * getRandomInt(1, 3));
      }
      const image = totalImages[Math.floor(Math.random() * totalImages.length)];
      await loadImage(`images/${image}`).then((image) => {
        ctx.drawImage(image, -35, -35, 70, 70);
      });
      ctx.restore();
      ctx.font = "18px PfennigBoldItalic";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 4;
      ctx.strokeText((index + 1).toString(), x + 5, y + 22);
      ctx.fillText((index + 1).toString(), x + 5, y + 22);
      x += 70;
      if (x > 140) {
        x = 0;
        y += 70;
      }
    }
    const res = {
      embeds: [embed],
      files: [canvas.toBuffer()],
      ephemeral: true,
      components: [row, row2],
    };
    if (interaction.customId.startsWith("role_")) interaction.update(res);
    else interaction.reply(res);
  },
};
