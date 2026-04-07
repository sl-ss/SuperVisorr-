const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  PermissionsBitField
} = from "discord.js";

const TOKEN = "MTQ5MDM4NDcwOTc1Mjk3OTY2Nw.GMNbgR.xFswLCBZtz8yAf1rCIi4RjoRb81uCZ11VIn-Vw";

// إعدادات الرتب والقنوات
const MIN_ADMIN_ROLE = "1489992647992148028"; // أقل رتبة إدارة
const VACATION_ROLE = "1489992604983623931"; 
const THANK_ROLE = "1489992803126607952"; 

const WARN_ROLES = {
  1: "1489992654316896408",
  2: "1489992655906803852",
  3: "1489992657424875541"
};

const TICKET_CHANNEL = "1489993145189007442"; // روم الأزرار
const APPLICATIONS_CHANNEL = "1489993097994834100"; // روم الطلبات

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ]
});

// لتخزين رتب الإجازة قبل السحب
const vacationRolesMap = new Map();
// لتخزين عدد التحذيرات
const warnings = new Map();

// تحقق صلاحية العضو
function canUseBot(member){
  const minRole = member.guild.roles.cache.get(MIN_ADMIN_ROLE);
  if(!minRole) return false;
  return member.roles.cache.some(r=>r.position >= minRole.position);
}

client.once("ready", async () => {
  console.log(`🔥 ${client.user.tag} جاهز`);

  // Embed الترحيب مع الأزرار
  const embed = new EmbedBuilder()
    .setTitle("📩 نظام الإدارة المتكامل")
    .setDescription(`حياكم الله، هذا البوت صنع خصيصًا لكم عشان نريحكم على الآخر.  
تفضل من هنا تقدر تحذر العضو تحذير عادي أو تحذير مع Time Out،  
أو تطلب إجازة أو تستقيل من الإدارة.`)
    .setColor("#ff0000");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("warn_simple").setLabel("تحذير عادي").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("warn_timeout").setLabel("تحذير + Time Out").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("vacation").setLabel("طلب إجازة").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("resignation").setLabel("طلب استقالة").setStyle(ButtonStyle.Secondary)
  );

  const channel = await client.channels.fetch(TICKET_CHANNEL);
  if(channel) channel.send({ embeds: [embed], components: [row] }).catch(console.error);
});

// ===== التعامل مع الأزرار =====
client.on("interactionCreate", async interaction => {
  if(!interaction.isButton()) return;

  const member = interaction.member;
  if(!canUseBot(member)){
    return interaction.reply({ content:"❌ ليس لديك صلاحية استخدام هذا الزر", ephemeral:true });
  }

  const userId = interaction.user.id;
  const filter = m=> m.author.id===userId;

  // ===== تحذير عادي =====
  if(interaction.customId === "warn_simple"){
    await interaction.deferReply({ ephemeral:true });
    interaction.channel.send("📝 اكتب ID العضو أو Mention الذي تريد تحذيره:");
    const collector1 = interaction.channel.createMessageCollector({ filter, max:1 });
    collector1.on("collect", async msg1=>{
      // تحويل Mention إلى ID إذا كتب @mention
      let memberId = msg1.content.replace(/[<@!>]/g, "");
      const target = await interaction.guild.members.fetch(memberId).catch(()=>null);
      if(!target) return msg1.reply("❌ العضو غير موجود");

      msg1.delete().catch(()=>{}); // حذف رسالة الإداري

      const current = warnings.get(target.id)||0;
      const newWarning = current+1;
      warnings.set(target.id,newWarning);

      // إزالة رتب التحذير السابقة
      for(const key of Object.keys(WARN_ROLES)){
        await target.roles.remove(WARN_ROLES[key]).catch(()=>{});
      }

      if(newWarning<=3){
        await target.roles.add(WARN_ROLES[newWarning]).catch(()=>null);
        interaction.followUp(`✅ تم تحذير ${target.user.tag}. عدد التحذيرات: ${newWarning}`);
      }else{
        interaction.followUp(`⚠️ ${target.user.tag} وصل الحد الأقصى من التحذيرات`);
      }
    });
  }

  // ===== تحذير + Time Out =====
  if(interaction.customId==="warn_timeout"){
    await interaction.deferReply({ ephemeral:true });
    interaction.channel.send("📝 اكتب ID العضو أو Mention الذي تريد تحذيره:");
    const collector1 = interaction.channel.createMessageCollector({ filter, max:1 });
    collector1.on("collect", async msg1=>{
      let memberId = msg1.content.replace(/[<@!>]/g, "");
      const target = await interaction.guild.members.fetch(memberId).catch(()=>null);
      if(!target) return msg1.reply("❌ العضو غير موجود");

      msg1.delete().catch(()=>{}); // حذف رسالة الإداري

      interaction.channel.send("⏳ اكتب مدة Time Out بالدقائق:");
      const collector2 = interaction.channel.createMessageCollector({ filter, max:1 });
      collector2.on("collect", async msg2=>{
        const duration = parseInt(msg2.content);
        if(isNaN(duration)) return msg2.reply("❌ أدخل رقم صحيح");

        msg2.delete().catch(()=>{}); // حذف رسالة الإداري

        interaction.channel.send("📝 اكتب سبب التحذير:");
        const collector3 = interaction.channel.createMessageCollector({ filter, max:1 });
        collector3.on("collect", async msg3=>{
          const reason = msg3.content;
          msg3.delete().catch(()=>{}); // حذف رسالة الإداري

          await target.timeout(duration*60*1000, reason).catch(()=>null);

          const current = warnings.get(target.id)||0;
          const newWarning = current+1;
          warnings.set(target.id,newWarning);

          // إزالة رتب التحذيرات السابقة
          for(const key of Object.keys(WARN_ROLES)){
            await target.roles.remove(WARN_ROLES[key]).catch(()=>{});
          }

          if(newWarning<=3){
            await target.roles.add(WARN_ROLES[newWarning]).catch(()=>null);
            interaction.followUp(`✅ تم تحذير ${target.user.tag} لمدة ${duration} دقيقة. عدد التحذيرات: ${newWarning}. سبب: ${reason}`);
          }else{
            interaction.followUp(`⚠️ ${target.user.tag} وصل الحد الأقصى من التحذيرات`);
          }
        });
      });
    });
  }

  // ===== باقي الكود (طلب إجازة، استقالة، قبول/رفض) =====
  // كل MessageCollector فيها msg.delete() بعد جمع المعلومات
});

client.login(TOKEN);
