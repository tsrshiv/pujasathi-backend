import mongoose from "mongoose";

const pujaSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Please enter the title of the puja"],
            trim: true,
        },
        description: {
            type: String,
            required: [true, "Please enter the description of the puja"],
        },
        category: {
            type: String,
            required: [true, "Please enter the category of the puja"],
            enum: ["Katha and Path", "Festival Pooja", "Havan", "Yagna", "Archana", "Abhishekam", "Homam", "Other"],
        },

        priceWithoutSamagri: {
            type: Number,
            required: [true, "Please enter the price of the puja without samagri"],
        },

        priceWithSamagri: {
            type: Number,
            required: [true, "Please enter the price of the puja with samagri"],
        },          

        durationInHours: {
            type: Number,
            default: 1,
        },

        samagriList: [{
      type: String
    }],

    imageUrl: {
      type: String,
      default: ""
    }
    },

    {timestamps: true}
);

export default mongoose.model("Puja", pujaSchema);


